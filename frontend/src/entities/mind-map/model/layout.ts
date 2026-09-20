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
const NODE_GAP_Y = 20;
const COMPACT_INDENT = 28;
const COMPACT_GAP_Y = 16;
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

function subtreeWidth(nodes: readonly MindMapNode[], nodeId: string): number {
  const node = nodes.find((item) => item.id === nodeId);
  const ownWidth = node ? nodeBox(node).width : LABEL_MIN_WIDTH;
  const children = childrenOf(nodes, nodeId);
  if (children.length === 0) {
    return ownWidth;
  }
  const childWidths = children.map((child) => subtreeWidth(nodes, child.id));
  const gaps = Math.max(0, children.length - 1) * NODE_GAP_X;
  return Math.max(
    ownWidth,
    childWidths.reduce((sum, width) => sum + width, 0) + gaps
  );
}

function placeSubtree(
  nodes: readonly MindMapNode[],
  node: MindMapNode,
  left: number,
  depth: number,
  rowTop: number,
  placed: LaidOutMindMapNode[]
): number {
  const box = nodeBox(node);
  const width = subtreeWidth(nodes, node.id);
  placed.push({
    id: node.id,
    label: node.label,
    x: left + width / 2 - box.width / 2,
    y: rowTop,
    depth,
    width: box.width,
    height: box.height,
  });

  const children = childrenOf(nodes, node.id);
  let cursor = left;
  let nextRow = rowTop + box.height + NODE_GAP_Y;
  for (const child of children) {
    const childWidth = subtreeWidth(nodes, child.id);
    const childBottom = placeSubtree(
      nodes,
      child,
      cursor,
      depth + 1,
      rowTop + box.height + NODE_GAP_Y,
      placed
    );
    nextRow = Math.max(nextRow, childBottom);
    cursor += childWidth + NODE_GAP_X;
  }
  return children.length === 0 ? rowTop + box.height : nextRow;
}

function layoutCompactMindMap(nodes: readonly MindMapNode[]): MindMapLayout {
  const knownIds = new Set(nodes.map((node) => node.id));
  const roots = nodes.filter(
    (node) => node.parentId === null || !knownIds.has(node.parentId)
  );
  const placed: LaidOutMindMapNode[] = [];
  let top = 0;

  const walk = (node: MindMapNode, depth: number): void => {
    const box = nodeBox(node);
    placed.push({
      id: node.id,
      label: node.label,
      x: depth * COMPACT_INDENT,
      y: top,
      depth,
      width: box.width,
      height: box.height,
    });
    top += box.height + COMPACT_GAP_Y;
    for (const child of childrenOf(nodes, node.id)) {
      walk(child, depth + 1);
    }
  };

  for (const root of roots) {
    walk(root, 0);
    top += COMPACT_GAP_Y;
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
    placeSubtree(nodes, root, cursor, 0, 0, placed);
    cursor += width + NODE_GAP_X * 2;
  }

  return { nodes: placed, edges: edgesFor(nodes, knownIds) };
}
