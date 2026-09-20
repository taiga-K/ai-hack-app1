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
import { Button } from "@/shared/ui";
import { cn } from "cn";
import {
  shouldCommitMindMapCameraMemory,
  shouldDeferMindMapResizeFit,
  shouldRefitMindMapCamera,
  usesStackedMindMapLayout,
} from "../model/should-refit-camera";
import { viewportFromMindMapLayout } from "../model/viewport-from-layout";

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
        "motion-safe:animate-cute-label-enter flex w-full items-center justify-center rounded-full px-3 py-1.5 text-center text-sm leading-5 break-words whitespace-normal",
        tone
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-0 !bg-transparent"
      />
      <span>{data.label}</span>
      <Handle
        type="source"
        position={Position.Right}
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

function readVisiblePaneSize(
  pane: HTMLDivElement | null,
  fallbackWidth: number,
  fallbackHeight: number
): { width: number; height: number } {
  if (pane !== null && pane.clientWidth > 8 && pane.clientHeight > 8) {
    return { width: pane.clientWidth, height: pane.clientHeight };
  }
  return { width: fallbackWidth, height: fallbackHeight };
}

function fitMaxZoom(stacked: boolean): number {
  return stacked ? 1 : MAX_ZOOM;
}

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
  const [measuredPane, setMeasuredPane] = useState({ width: 0, height: 0 });
  const paneRef = useRef<HTMLDivElement>(null);
  const { setViewport } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const storeWidth = useStore((state) => state.width);
  const storeHeight = useStore((state) => state.height);
  const width = measuredPane.width > 8 ? measuredPane.width : storeWidth;
  const height = measuredPane.height > 8 ? measuredPane.height : storeHeight;
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
    const pane = paneRef.current;
    if (pane === null) {
      return;
    }
    const syncPane = (nextWidth: number, nextHeight: number): void => {
      setMeasuredPane((current) => {
        if (
          Math.abs(current.width - nextWidth) <= 4 &&
          Math.abs(current.height - nextHeight) <= 4
        ) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) {
        return;
      }
      syncPane(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(pane);
    syncPane(pane.clientWidth, pane.clientHeight);
    return () => {
      observer.disconnect();
    };
  }, [hasNodes]);

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
    const visible = readVisiblePaneSize(paneRef.current, width, height);
    const previous = lastSizeRef.current;
    const sizeChanged =
      previous.width > 0 &&
      (Math.abs(previous.width - visible.width) > 2 ||
        Math.abs(previous.height - visible.height) > 2);
    const isFirstLayout = !didInitialFit.current;
    const previousSignature = lastNodeSignatureRef.current;
    const nodesChanged =
      previousSignature.length > 0 && previousSignature !== nodeSignature;
    const shouldFit = shouldRefitMindMapCamera({
      hasNodes,
      nodesInitialized,
      width: visible.width,
      height: visible.height,
      isFirstLayout,
      sizeChanged,
      nodesChanged,
      userTookCamera,
    });
    if (!shouldFit) {
      if (
        shouldCommitMindMapCameraMemory({
          fitRan: false,
          nodesInitialized,
          userTookCamera,
        })
      ) {
        lastSizeRef.current = visible;
        lastNodeSignatureRef.current = nodeSignature;
      }
      return;
    }
    const deferResize = shouldDeferMindMapResizeFit({
      sizeChanged,
      isFirstLayout,
      nodesChanged,
    });
    const runFit = (): void => {
      const nextVisible = readVisiblePaneSize(paneRef.current, width, height);
      const viewport = viewportFromMindMapLayout(
        layout.nodes,
        nextVisible.width,
        nextVisible.height,
        FIT_PADDING,
        MIN_ZOOM,
        fitMaxZoom(stacked)
      );
      if (viewport === null) {
        return;
      }
      lastSizeRef.current = nextVisible;
      lastNodeSignatureRef.current = nodeSignature;
      didInitialFit.current = true;
      const duration = deferResize ? 0 : isFirstLayout ? 320 : 200;
      if (duration > 0) {
        isFittingRef.current = true;
      }
      void setViewport(viewport, {
        duration,
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
    layout.nodes,
    setViewport,
    stacked,
    hasNodes,
    height,
    nodeSignature,
    nodesInitialized,
    userTookCamera,
    width,
  ]);

  return (
    <div
      ref={paneRef}
      className="relative h-full min-h-0 overflow-hidden"
      onWheel={() => {
        if (userTookCamera) {
          return;
        }
        setUserTookCamera(true);
      }}
    >
      {userTookCamera ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="absolute right-2 top-2 z-10"
          onClick={() => {
            setUserTookCamera(false);
            const visible = readVisiblePaneSize(paneRef.current, width, height);
            const viewport = viewportFromMindMapLayout(
              layout.nodes,
              visible.width,
              visible.height,
              FIT_PADDING,
              MIN_ZOOM,
              fitMaxZoom(stacked)
            );
            if (viewport === null) {
              setUserTookCamera(false);
              return;
            }
            isFittingRef.current = true;
            void setViewport(viewport, { duration: 280 }).finally(() => {
              isFittingRef.current = false;
            });
          }}
        >
          ぜんぶ見る
        </Button>
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
    <section
      aria-label="話の地図"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
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
