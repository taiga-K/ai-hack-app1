import { compactBox, mindmap } from "@antv/hierarchy";
import type { HierarchyData, HierarchyNode } from "@antv/hierarchy";
import type { MindMapNode, MindMapRelationKind } from "./types";

export interface LaidOutMindMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: number;
  width: number;
  height: number;
}

/** Tree edges follow the hierarchy; relation edges are the few extra lines. */
export type MindMapEdgeKind = "tree" | MindMapRelationKind;

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  kind: MindMapEdgeKind;
}

export interface MindMapLayout {
  nodes: LaidOutMindMapNode[];
  edges: MindMapEdge[];
}

export type MindMapLayoutAlgorithm = "mindmap" | "compactBox";

/** Extra room a pill needs besides its label: a chip in front, a count behind. */
export interface MindMapNodeDecoration {
  chipChars: number;
  badge: boolean;
}

export interface LayoutMindMapOptions {
  compact?: boolean;
  algorithm?: MindMapLayoutAlgorithm;
  decorationFor?: (node: MindMapNode) => MindMapNodeDecoration;
}

export const DEFAULT_MIND_MAP_LAYOUT_ALGORITHM: MindMapLayoutAlgorithm =
  "mindmap";

interface NestedMindMapNode {
  id: string;
  label: string;
  extraWidth: number;
  children: NestedMindMapNode[];
}

const NODE_GAP_X = 48;
const NODE_GAP_Y = 16;
const LABEL_CHAR_PX = 14;
const LABEL_PAD_X = 28;
const LABEL_PAD_Y = 16;
const LABEL_LINE_PX = 20;
const LABEL_MIN_WIDTH = 88;
const LABEL_MAX_WIDTH = 240;
const LABEL_MAX_LINES = 3;
const CHIP_CHAR_PX = 10;
const CHIP_PAD_PX = 22;
const BADGE_PX = 50;

export function measureMindMapDecoration(
  decoration: MindMapNodeDecoration | undefined
): number {
  if (decoration === undefined) {
    return 0;
  }
  const chip =
    decoration.chipChars > 0
      ? decoration.chipChars * CHIP_CHAR_PX + CHIP_PAD_PX
      : 0;
  return chip + (decoration.badge ? BADGE_PX : 0);
}

export function measureMindMapLabel(
  label: string,
  extraWidth = 0
): {
  width: number;
  height: number;
} {
  const chars = Array.from(label).length;
  const textWidth = chars * LABEL_CHAR_PX + extraWidth;
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

function nestMindMapForest(
  nodes: readonly MindMapNode[],
  decorationFor: LayoutMindMapOptions["decorationFor"]
): NestedMindMapNode[] {
  const knownIds = new Set(nodes.map((node) => node.id));
  const childrenByParent = new Map<string | null, MindMapNode[]>();

  for (const node of nodes) {
    const parentId =
      node.parentId !== null && knownIds.has(node.parentId)
        ? node.parentId
        : null;
    const siblings = childrenByParent.get(parentId);
    if (siblings === undefined) {
      childrenByParent.set(parentId, [node]);
      continue;
    }
    siblings.push(node);
  }

  function nest(node: MindMapNode): NestedMindMapNode {
    const children = childrenByParent.get(node.id) ?? [];
    return {
      id: node.id,
      label: node.label,
      extraWidth: measureMindMapDecoration(decorationFor?.(node)),
      children: children.map(nest),
    };
  }

  return (childrenByParent.get(null) ?? []).map(nest);
}

function toHierarchyData(node: NestedMindMapNode): HierarchyData {
  return {
    id: node.id,
    label: node.label,
    extraWidth: node.extraWidth,
    children: node.children.map(toHierarchyData),
  };
}

function measureHierarchyItem(item: HierarchyData): {
  width: number;
  height: number;
} {
  const extra = typeof item.extraWidth === "number" ? item.extraWidth : 0;
  return measureMindMapLabel(String(item.label ?? ""), extra);
}

function collectLaidOut(
  tree: HierarchyNode,
  placed: LaidOutMindMapNode[]
): void {
  const bounds = tree.getBoundingBox();
  tree.translate(-bounds.left, -bounds.top);
  tree.eachNode((node) => {
    const box = measureHierarchyItem(node.data);
    placed.push({
      id: node.id,
      label: String(node.data.label ?? ""),
      x: node.x + node.hgap,
      y: node.y + node.vgap,
      depth: node.depth,
      width: box.width,
      height: box.height,
    });
  });
}

function layoutNestedTree(
  root: NestedMindMapNode,
  algorithm: MindMapLayoutAlgorithm
): HierarchyNode {
  const data = toHierarchyData(root);
  const options = {
    direction: "LR" as const,
    fixedRoot: false,
    getId: (item: HierarchyData) => String(item.id ?? ""),
    getWidth: (item: HierarchyData) => measureHierarchyItem(item).width,
    getHeight: (item: HierarchyData) => measureHierarchyItem(item).height,
    getHGap: () => NODE_GAP_X / 2,
    getVGap: () => NODE_GAP_Y / 2,
  };
  switch (algorithm) {
    case "compactBox":
      return compactBox(data, options);
    case "mindmap":
      return mindmap(data, options);
    default: {
      const _exhaustiveCheck: never = algorithm;
      throw new Error(`Unhandled layout algorithm: ${_exhaustiveCheck}`);
    }
  }
}

function edgesFor(
  nodes: readonly MindMapNode[],
  knownIds: Set<string>
): MindMapEdge[] {
  const edges: MindMapEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const toParent = node.relations.find(
      (relation) => relation.targetId === node.parentId
    );
    if (node.parentId !== null && knownIds.has(node.parentId)) {
      const id = `${node.parentId}-${node.id}`;
      seen.add(id);
      edges.push({
        id,
        source: node.parentId,
        target: node.id,
        kind: toParent?.kind ?? "tree",
      });
    }
    for (const relation of node.relations) {
      if (
        relation.targetId === node.parentId ||
        relation.targetId === node.id ||
        !knownIds.has(relation.targetId)
      ) {
        continue;
      }
      const id = `${relation.kind}-${node.id}-${relation.targetId}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      edges.push({
        id,
        source: node.id,
        target: relation.targetId,
        kind: relation.kind,
      });
    }
  }
  return edges;
}

export function layoutMindMap(
  nodes: readonly MindMapNode[],
  options: LayoutMindMapOptions = {}
): MindMapLayout {
  void options.compact;
  const algorithm = options.algorithm ?? DEFAULT_MIND_MAP_LAYOUT_ALGORITHM;
  const knownIds = new Set(nodes.map((node) => node.id));
  const forest = nestMindMapForest(nodes, options.decorationFor);
  const placed: LaidOutMindMapNode[] = [];
  let offsetY = 0;

  for (const root of forest) {
    const tree = layoutNestedTree(root, algorithm);
    const start = placed.length;
    collectLaidOut(tree, placed);
    const slice = placed.slice(start);
    const minX = Math.min(...slice.map((node) => node.x));
    const minY = Math.min(...slice.map((node) => node.y));
    let maxBottom = 0;
    for (const node of slice) {
      node.x -= minX;
      node.y = node.y - minY + offsetY;
      maxBottom = Math.max(maxBottom, node.y + node.height);
    }
    offsetY = maxBottom + NODE_GAP_Y * 2;
  }

  return { nodes: placed, edges: edgesFor(nodes, knownIds) };
}
