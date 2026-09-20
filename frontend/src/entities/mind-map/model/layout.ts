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

const NODE_GAP_X = 48;
const NODE_GAP_Y = 16;
const LABEL_CHAR_PX = 14;
const LABEL_PAD_X = 28;
const LABEL_PAD_Y = 16;
const LABEL_LINE_PX = 20;
const LABEL_MIN_WIDTH = 88;
const LABEL_MAX_WIDTH = 224;
const LABEL_MAX_LINES = 3;

export function measureMindMapLabel(label: string): {
  width: number;
  height: number;
} {
  const chars = Array.from(label).length;
  const textWidth = chars * LABEL_CHAR_PX;
  const inner = LABEL_MAX_WIDTH - LABEL_PAD_X;
  const lines = Math.min(
    LABEL_MAX_LINES,
    Math.max(1, Math.ceil(Math.max(textWidth, 1) / inner))
  );
  return {
    width: Math.min(
      LABEL_MAX_WIDTH,
      Math.max(LABEL_MIN_WIDTH, textWidth + LABEL_PAD_X)
    ),
    height: LABEL_PAD_Y + lines * LABEL_LINE_PX,
  };
}

function childrenOf(
  nodes: readonly MindMapNode[],
  parentId: string | null
): MindMapNode[] {
  return nodes.filter((node) => node.parentId === parentId);
}

function nodeBox(node: MindMapNode): { width: number; height: number } {
  return measureMindMapLabel(node.label);
}

function subtreeHeight(nodes: readonly MindMapNode[], nodeId: string): number {
  const node = nodes.find((item) => item.id === nodeId);
  const ownHeight = node ? nodeBox(node).height : LABEL_PAD_Y + LABEL_LINE_PX;
  const children = childrenOf(nodes, nodeId);
  if (children.length === 0) {
    return ownHeight;
  }
  const childHeights = children.map((child) => subtreeHeight(nodes, child.id));
  const gaps = Math.max(0, children.length - 1) * NODE_GAP_Y;
  return Math.max(
    ownHeight,
    childHeights.reduce((sum, height) => sum + height, 0) + gaps
  );
}

function placeSubtree(
  nodes: readonly MindMapNode[],
  node: MindMapNode,
  left: number,
  depth: number,
  top: number,
  placed: LaidOutMindMapNode[]
): number {
  const box = nodeBox(node);
  const height = subtreeHeight(nodes, node.id);
  placed.push({
    id: node.id,
    label: node.label,
    x: left,
    y: top + height / 2 - box.height / 2,
    depth,
    width: box.width,
    height: box.height,
  });

  const children = childrenOf(nodes, node.id);
  let cursor = top;
  const childLeft = left + box.width + NODE_GAP_X;
  for (const child of children) {
    const childHeight = subtreeHeight(nodes, child.id);
    placeSubtree(nodes, child, childLeft, depth + 1, cursor, placed);
    cursor += childHeight + NODE_GAP_Y;
  }
  return top + height;
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
  void options.compact;
  const knownIds = new Set(nodes.map((node) => node.id));
  const roots = nodes.filter(
    (node) => node.parentId === null || !knownIds.has(node.parentId)
  );
  const placed: LaidOutMindMapNode[] = [];
  let top = 0;

  for (const root of roots) {
    const height = subtreeHeight(nodes, root.id);
    placeSubtree(nodes, root, 0, 0, top, placed);
    top += height + NODE_GAP_Y * 2;
  }

  return { nodes: placed, edges: edgesFor(nodes, knownIds) };
}
