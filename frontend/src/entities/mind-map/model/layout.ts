import type { MindMapNode } from "./types";

export interface LaidOutMindMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: number;
  width: number;
  height: number;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
}

export interface MindMapLayout {
  nodes: LaidOutMindMapNode[];
  edges: MindMapEdge[];
}

export interface LayoutMindMapOptions {
  compact?: boolean;
}

const NODE_GAP_X = 28;
const NODE_GAP_Y = 76;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 36;
const COMPACT_INDENT = 28;
const COMPACT_GAP_Y = 54;

function childrenOf(
  nodes: readonly MindMapNode[],
  parentId: string | null
): MindMapNode[] {
  return nodes.filter((node) => node.parentId === parentId);
}

function subtreeWidth(nodes: readonly MindMapNode[], nodeId: string): number {
  const children = childrenOf(nodes, nodeId);
  if (children.length === 0) {
    return NODE_WIDTH;
  }
  const childWidths = children.map((child) => subtreeWidth(nodes, child.id));
  const gaps = Math.max(0, children.length - 1) * NODE_GAP_X;
  return Math.max(
    NODE_WIDTH,
    childWidths.reduce((sum, width) => sum + width, 0) + gaps
  );
}

function placeSubtree(
  nodes: readonly MindMapNode[],
  node: MindMapNode,
  left: number,
  depth: number,
  placed: LaidOutMindMapNode[]
): void {
  const width = subtreeWidth(nodes, node.id);
  placed.push({
    id: node.id,
    label: node.label,
    x: left + width / 2 - NODE_WIDTH / 2,
    y: depth * NODE_GAP_Y,
    depth,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  });

  const children = childrenOf(nodes, node.id);
  let cursor = left;
  for (const child of children) {
    const childWidth = subtreeWidth(nodes, child.id);
    placeSubtree(nodes, child, cursor, depth + 1, placed);
    cursor += childWidth + NODE_GAP_X;
  }
}

function layoutCompactMindMap(nodes: readonly MindMapNode[]): MindMapLayout {
  const knownIds = new Set(nodes.map((node) => node.id));
  const roots = nodes.filter(
    (node) => node.parentId === null || !knownIds.has(node.parentId)
  );
  const placed: LaidOutMindMapNode[] = [];
  let row = 0;

  const walk = (node: MindMapNode, depth: number): void => {
    placed.push({
      id: node.id,
      label: node.label,
      x: depth * COMPACT_INDENT,
      y: row * COMPACT_GAP_Y,
      depth,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
    row += 1;
    for (const child of childrenOf(nodes, node.id)) {
      walk(child, depth + 1);
    }
  };

  for (const root of roots) {
    walk(root, 0);
    row += 1;
  }

  return {
    nodes: placed,
    edges: edgesFor(nodes, knownIds),
  };
}

function edgesFor(
  nodes: readonly MindMapNode[],
  knownIds: Set<string>
): MindMapEdge[] {
  return nodes.flatMap((node) => {
    if (node.parentId === null || !knownIds.has(node.parentId)) {
      return [];
    }
    return [
      {
        id: `${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
      },
    ];
  });
}

export function layoutMindMap(
  nodes: readonly MindMapNode[],
  options: LayoutMindMapOptions = {}
): MindMapLayout {
  if (options.compact) {
    return layoutCompactMindMap(nodes);
  }
  const knownIds = new Set(nodes.map((node) => node.id));
  const roots = nodes.filter(
    (node) => node.parentId === null || !knownIds.has(node.parentId)
  );
  const placed: LaidOutMindMapNode[] = [];
  let cursor = 0;

  for (const root of roots) {
    const width = subtreeWidth(nodes, root.id);
    placeSubtree(nodes, root, cursor, 0, placed);
    cursor += width + NODE_GAP_X * 2;
  }

  return { nodes: placed, edges: edgesFor(nodes, knownIds) };
}
