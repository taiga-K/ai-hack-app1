"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutMindMap, type MindMapSnapshot } from "@/entities/mind-map";
import { cn } from "cn";

export interface MindMapCanvasProps {
  snapshot: MindMapSnapshot;
  growing?: boolean;
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
        "max-w-44 rounded-full px-3 py-1.5 text-center text-sm leading-snug",
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

function MindMapFlow({ snapshot }: { snapshot: MindMapSnapshot }) {
  const { fitView } = useReactFlow();
  const layout = useMemo(() => layoutMindMap(snapshot.nodes), [snapshot.nodes]);
  const nodes: Node<TopicNodeData>[] = useMemo(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: "topic",
        position: { x: node.x, y: node.y },
        data: { label: node.label, depth: node.depth },
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

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.28, duration: 380 });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [fitView, nodes.length, snapshot.revision]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      panOnDrag
      zoomOnScroll
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      className="h-full bg-transparent"
    >
      <Background gap={22} size={1} color="var(--border)" />
    </ReactFlow>
  );
}

export function MindMapCanvas({
  snapshot,
  growing = false,
}: MindMapCanvasProps) {
  const isEmpty = snapshot.nodes.length === 0;

  return (
    <section aria-label="話の地図" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {isEmpty ? (
          <p className="px-1 py-8 text-sm text-muted-foreground">
            {growing
              ? "話をききながら、地図をかいています"
              : "話しはじめると、ここにちいさな地図が育ちます"}
          </p>
        ) : (
          <ReactFlowProvider>
            <MindMapFlow snapshot={snapshot} />
          </ReactFlowProvider>
        )}
      </div>
    </section>
  );
}
