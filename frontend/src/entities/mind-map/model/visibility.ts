import type { MindMapNode } from "./types";

/** Root is depth 1; the meeting map starts shallow and opens on demand. */
export const MIND_MAP_INITIAL_VISIBLE_DEPTH = 2;

export interface MindMapVisibility {
  visible: MindMapNode[];
  hiddenChildCount: ReadonlyMap<string, number>;
  depthById: ReadonlyMap<string, number>;
}

function childrenByParent(
  nodes: readonly MindMapNode[]
): Map<string | null, MindMapNode[]> {
  const knownIds = new Set(nodes.map((node) => node.id));
  const children = new Map<string | null, MindMapNode[]>();
  for (const node of nodes) {
    const parentId =
      node.parentId !== null && knownIds.has(node.parentId)
        ? node.parentId
        : null;
    const siblings = children.get(parentId);
    if (siblings === undefined) {
      children.set(parentId, [node]);
      continue;
    }
    siblings.push(node);
  }
  return children;
}

export function computeMindMapDepths(
  nodes: readonly MindMapNode[]
): Map<string, number> {
  const children = childrenByParent(nodes);
  const depthById = new Map<string, number>();
  const queue: Array<{ node: MindMapNode; depth: number }> = (
    children.get(null) ?? []
  ).map((node) => ({ node, depth: 1 }));
  while (queue.length > 0) {
    const item = queue.shift();
    if (item === undefined) {
      break;
    }
    if (depthById.has(item.node.id)) {
      continue;
    }
    depthById.set(item.node.id, item.depth);
    for (const child of children.get(item.node.id) ?? []) {
      queue.push({ node: child, depth: item.depth + 1 });
    }
  }
  return depthById;
}

/** Decisions and next actions stay in view even when their branch is closed. */
export function isAlwaysVisibleMindMapNode(node: MindMapNode): boolean {
  if (node.status === "superseded") {
    return false;
  }
  return node.kind === "decision" || node.kind === "action";
}

export function resolveMindMapVisibility(
  nodes: readonly MindMapNode[],
  expandedIds: ReadonlySet<string>
): MindMapVisibility {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = childrenByParent(nodes);
  const depthById = computeMindMapDepths(nodes);

  const anchors = new Set<string>();
  for (const node of nodes) {
    const depth = depthById.get(node.id) ?? 1;
    if (
      depth <= MIND_MAP_INITIAL_VISIBLE_DEPTH &&
      node.status !== "superseded"
    ) {
      anchors.add(node.id);
    }
    if (!isAlwaysVisibleMindMapNode(node)) {
      continue;
    }
    let current: MindMapNode | undefined = node;
    while (current !== undefined && !anchors.has(current.id)) {
      anchors.add(current.id);
      current =
        current.parentId === null ? undefined : byId.get(current.parentId);
    }
  }

  const visibleIds = new Set<string>();
  const visible: MindMapNode[] = [];
  const queue: MindMapNode[] = [...(children.get(null) ?? [])];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      break;
    }
    const parentVisible =
      node.parentId === null ||
      !byId.has(node.parentId) ||
      visibleIds.has(node.parentId);
    const parentExpanded =
      node.parentId !== null && expandedIds.has(node.parentId);
    const shown = parentVisible && (anchors.has(node.id) || parentExpanded);
    if (shown) {
      visibleIds.add(node.id);
      visible.push(node);
    }
    for (const child of children.get(node.id) ?? []) {
      queue.push(child);
    }
  }

  const hiddenChildCount = new Map<string, number>();
  for (const node of visible) {
    const hidden = (children.get(node.id) ?? []).filter(
      (child) => !visibleIds.has(child.id)
    ).length;
    if (hidden > 0) {
      hiddenChildCount.set(node.id, hidden);
    }
  }

  return { visible, hiddenChildCount, depthById };
}

export function toggleMindMapBranch(
  expandedIds: ReadonlySet<string>,
  nodeId: string
): Set<string> {
  const next = new Set(expandedIds);
  if (next.has(nodeId)) {
    next.delete(nodeId);
  } else {
    next.add(nodeId);
  }
  return next;
}

export function selectedMindMapNode(
  nodes: readonly MindMapNode[],
  selectedId: string | null
): MindMapNode | null {
  if (selectedId === null) {
    return null;
  }
  return nodes.find((node) => node.id === selectedId) ?? null;
}
