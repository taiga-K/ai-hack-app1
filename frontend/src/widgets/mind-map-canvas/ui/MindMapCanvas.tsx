"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutMindMap, type MindMapSnapshot } from "@/entities/mind-map";
import { cn } from "cn";
import {
  shouldDeferMindMapResizeFit,
  shouldRefitMindMapCamera,
  usesStackedMindMapLayout,
} from "../model/should-refit-camera";

export interface MindMapCanvasProps {
  snapshot: MindMapSnapshot;
  compact?: boolean;
}

interface TopicNodeData extends Record<string, unknown> {
  label: string;
  depth: number;
}

function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const tone =
    data.depth === 0
      ? "bg-secondary text-secondary-foreground"
      : data.depth % 2 === 1
        ? "bg-accent/70 text-accent-foreground"
        : "bg-muted text-foreground";

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full px-3 text-center text-sm leading-snug",
        tone
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-0 !bg-transparent"
      />
      <span>{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-0 !bg-transparent"
      />
    </div>
  );
}

const nodeTypes = {
  topic: TopicNode,
};

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 1.45;
const FIT_PADDING = 0.12;
const RESIZE_FIT_MS = 220;

function MindMapFlow({
  snapshot,
  compact,
}: {
  snapshot: MindMapSnapshot;
  compact: boolean;
}) {
  const didInitialFit = useRef(false);
  const compactRef = useRef(compact);
  const stackedForFitRef = useRef(compact);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const lastNodeSignatureRef = useRef("");
  const isFittingRef = useRef(false);
  const [userTookCamera, setUserTookCamera] = useState(false);
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const stacked = usesStackedMindMapLayout(width, compact);
  const layout = useMemo(
    () => layoutMindMap(snapshot.nodes, { compact: stacked }),
    [snapshot.nodes, stacked]
  );
  const nodes: Node<TopicNodeData>[] = useMemo(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: "topic",
        position: { x: node.x, y: node.y },
        data: { label: node.label, depth: node.depth },
        width: node.width,
        height: node.height,
        style: { width: node.width, height: node.height },
        draggable: false,
        selectable: false,
        className: "motion-safe:animate-cute-enter",
      })),
    [layout.nodes]
  );
  const edges: Edge[] = useMemo(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
      })),
    [layout.edges]
  );
  const hasNodes = snapshot.nodes.length > 0;
  const nodeSignature = `${String(snapshot.revision)}:${snapshot.nodes
    .map((node) => node.id)
    .join(",")}`;

  useEffect(() => {
    if (
      compactRef.current !== compact ||
      stackedForFitRef.current !== stacked
    ) {
      compactRef.current = compact;
      stackedForFitRef.current = stacked;
      didInitialFit.current = false;
      lastSizeRef.current = { width: 0, height: 0 };
    }
    const previous = lastSizeRef.current;
    const sizeChanged =
      previous.width > 0 &&
      (Math.abs(previous.width - width) > 2 ||
        Math.abs(previous.height - height) > 2);
    const isFirstLayout = !didInitialFit.current;
    const previousSignature = lastNodeSignatureRef.current;
    const nodesChanged =
      previousSignature.length > 0 && previousSignature !== nodeSignature;
    lastSizeRef.current = { width, height };
    lastNodeSignatureRef.current = nodeSignature;
    if (
      !shouldRefitMindMapCamera({
        hasNodes,
        nodesInitialized,
        width,
        height,
        isFirstLayout,
        sizeChanged,
        nodesChanged,
        userTookCamera,
      })
    ) {
      return;
    }
    const deferResize = shouldDeferMindMapResizeFit({
      sizeChanged,
      isFirstLayout,
      nodesChanged,
    });
    const runFit = (): void => {
      isFittingRef.current = true;
      didInitialFit.current = true;
      void fitView({
        padding: FIT_PADDING,
        duration: deferResize ? 0 : isFirstLayout ? 320 : 200,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }).finally(() => {
        isFittingRef.current = false;
      });
    };
    if (deferResize) {
      const timer = window.setTimeout(runFit, RESIZE_FIT_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }
    const frame = window.requestAnimationFrame(runFit);
    return () => {
      window.cancelAnimationFrame(frame);
      isFittingRef.current = false;
    };
  }, [
    compact,
    fitView,
    stacked,
    hasNodes,
    height,
    nodeSignature,
    nodesInitialized,
    userTookCamera,
    width,
  ]);

  return (
    <div className="relative h-full min-h-0">
      {userTookCamera ? (
        <button
          type="button"
          className="absolute right-2 top-2 z-10 text-sm text-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setUserTookCamera(false);
            isFittingRef.current = true;
            void fitView({
              padding: FIT_PADDING,
              duration: 280,
              minZoom: MIN_ZOOM,
              maxZoom: MAX_ZOOM,
            }).finally(() => {
              isFittingRef.current = false;
            });
          }}
        >
          ぜんぶ見る
        </button>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        panOnDrag
        zoomOnScroll
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        proOptions={{ hideAttribution: true }}
        className="h-full bg-transparent"
        onMove={(event) => {
          if (event === null || isFittingRef.current || userTookCamera) {
            return;
          }
          setUserTookCamera(true);
        }}
      >
        <Background gap={22} size={1} color="var(--border)" />
      </ReactFlow>
    </div>
  );
}

export function MindMapCanvas({
  snapshot,
  compact = false,
}: MindMapCanvasProps) {
  const isEmpty = snapshot.nodes.length === 0;

  return (
    <section aria-label="話の地図" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {isEmpty ? (
          <p className="px-1 py-8 text-sm text-muted-foreground">
            話しはじめると、ここにちいさな地図が育ちます
          </p>
        ) : (
          <ReactFlowProvider>
            <MindMapFlow snapshot={snapshot} compact={compact} />
          </ReactFlowProvider>
        )}
      </div>
    </section>
  );
}
