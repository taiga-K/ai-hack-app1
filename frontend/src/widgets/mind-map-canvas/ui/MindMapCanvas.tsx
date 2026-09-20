"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutMindMap, type MindMapSnapshot } from "@/entities/mind-map";
import { cn } from "cn";

export interface MindMapCanvasProps {
  snapshot: MindMapSnapshot;
  compact?: boolean;
}

interface TopicNodeData extends Record<string, unknown> {
  label: string;
  depth: number;
  compact: boolean;
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
        "rounded-full px-3 py-1.5 text-center text-sm leading-snug",
        data.compact ? "max-w-52" : "max-w-44",
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

function MindMapFlow({
  snapshot,
  compact,
}: {
  snapshot: MindMapSnapshot;
  compact: boolean;
}) {
  const didInitialFit = useRef(false);
  const compactRef = useRef(compact);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const { fitView } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const layout = useMemo(
    () => layoutMindMap(snapshot.nodes, { compact }),
    [compact, snapshot.nodes]
  );
  const nodes: Node<TopicNodeData>[] = useMemo(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: "topic",
        position: { x: node.x, y: node.y },
        data: { label: node.label, depth: node.depth, compact },
        draggable: false,
        selectable: false,
        className: "motion-safe:animate-cute-enter",
      })),
    [compact, layout.nodes]
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
  const minZoom = compact ? 0.85 : 0.4;
  const maxZoom = compact ? 1.15 : 1.5;
  const padding = compact ? 0.1 : 0.18;

  useEffect(() => {
    if (compactRef.current !== compact) {
      compactRef.current = compact;
      didInitialFit.current = false;
      lastSizeRef.current = { width: 0, height: 0 };
    }
    if (!hasNodes || width < 8 || height < 8) {
      return;
    }
    const previous = lastSizeRef.current;
    const sizeChanged =
      previous.width > 0 &&
      (Math.abs(previous.width - width) > 2 ||
        Math.abs(previous.height - height) > 2);
    const isFirstLayout = !didInitialFit.current;
    lastSizeRef.current = { width, height };
    if (!isFirstLayout && !sizeChanged) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      didInitialFit.current = true;
      void fitView({
        padding,
        duration: isFirstLayout ? 380 : 180,
        minZoom,
        maxZoom,
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [compact, fitView, hasNodes, height, maxZoom, minZoom, padding, width]);

  return (
    <div className="h-full min-h-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        panOnDrag
        zoomOnScroll
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={minZoom}
        maxZoom={maxZoom}
        proOptions={{ hideAttribution: true }}
        className="h-full bg-transparent"
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
