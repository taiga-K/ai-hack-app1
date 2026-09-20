import type { MindMapNodeDecoration } from "./layout";
import type {
  MindMapNode,
  MindMapNodeKind,
  MindMapNodeStatus,
  MindMapRelationKind,
} from "./types";
import type { MindMapVisibility } from "./visibility";

export const MIND_MAP_KIND_LABELS: Record<MindMapNodeKind, string> = {
  topic: "話題",
  report: "共有",
  proposal: "案",
  reason: "理由",
  concern: "気になる点",
  decision: "決定",
  action: "つぎにやること",
};

export const MIND_MAP_STATUS_LABELS: Record<MindMapNodeStatus, string> = {
  open: "まだ決まっていない",
  decided: "決定",
  pending: "あとで",
  superseded: "いまは対象外",
};

/** A proposal that was decided on reads as "adopted" rather than a second 決定. */
export const MIND_MAP_ADOPTED_LABEL = "採用";

export const MIND_MAP_RELATION_LABELS: Record<MindMapRelationKind, string> = {
  supports: "賛成",
  opposes: "懸念",
  supersedes: "置きかえ",
};

export type MindMapNodeTone =
  "root" | "topic" | "proposal" | "concern" | "decision" | "action" | "history";

export interface MindMapNodePresentation {
  /** One short chip in front of the label, or null for plain topics. */
  chip: string | null;
  tone: MindMapNodeTone;
  struck: boolean;
}

export function getMindMapNodePresentation(
  node: MindMapNode,
  depth: number
): MindMapNodePresentation {
  if (node.status === "superseded") {
    return {
      chip: MIND_MAP_STATUS_LABELS.superseded,
      tone: "history",
      struck: true,
    };
  }
  if (node.kind === "decision") {
    return {
      chip: MIND_MAP_STATUS_LABELS.decided,
      tone: "decision",
      struck: false,
    };
  }
  if (node.status === "decided") {
    return {
      chip:
        node.kind === "proposal"
          ? MIND_MAP_ADOPTED_LABEL
          : MIND_MAP_STATUS_LABELS.decided,
      tone: "decision",
      struck: false,
    };
  }
  if (node.kind === "action") {
    return { chip: MIND_MAP_KIND_LABELS.action, tone: "action", struck: false };
  }
  if (node.status === "pending") {
    return {
      chip: MIND_MAP_STATUS_LABELS.pending,
      tone: "topic",
      struck: false,
    };
  }
  switch (node.kind) {
    case "concern":
      return {
        chip: MIND_MAP_KIND_LABELS.concern,
        tone: "concern",
        struck: false,
      };
    case "proposal":
      return {
        chip: MIND_MAP_KIND_LABELS.proposal,
        tone: "proposal",
        struck: false,
      };
    case "reason":
      return {
        chip: MIND_MAP_KIND_LABELS.reason,
        tone: "topic",
        struck: false,
      };
    case "report":
    case "topic":
      return { chip: null, tone: depth <= 1 ? "root" : "topic", struck: false };
    default: {
      const _exhaustiveCheck: never = node.kind;
      throw new Error(`Unhandled mind-map kind: ${_exhaustiveCheck}`);
    }
  }
}

export function describeMindMapStatus(node: MindMapNode): string {
  if (node.kind === "decision") {
    return MIND_MAP_STATUS_LABELS.decided;
  }
  if (node.kind === "proposal" && node.status === "decided") {
    return MIND_MAP_ADOPTED_LABEL;
  }
  return MIND_MAP_STATUS_LABELS[node.status];
}

/** "決定・決定" reads badly; collapse kind and status when they coincide. */
export function describeMindMapNode(node: MindMapNode): string {
  const kind = MIND_MAP_KIND_LABELS[node.kind];
  const status = describeMindMapStatus(node);
  return kind === status ? kind : `${kind}・${status}`;
}

/** How much a pill widens for its chip and its hidden-children count. */
export function decorationForMindMapNode(
  node: MindMapNode,
  visibility: MindMapVisibility
): MindMapNodeDecoration {
  const presentation = getMindMapNodePresentation(
    node,
    visibility.depthById.get(node.id) ?? 1
  );
  return {
    chipChars:
      presentation.chip === null ? 0 : Array.from(presentation.chip).length,
    badge: visibility.hiddenChildCount.has(node.id),
  };
}

export interface MindMapBranchSummary {
  decisions: MindMapNode[];
  adopted: MindMapNode[];
  actions: MindMapNode[];
  openCount: number;
}

function descendantsOf(
  node: MindMapNode,
  nodes: readonly MindMapNode[]
): MindMapNode[] {
  const children = new Map<string, MindMapNode[]>();
  for (const item of nodes) {
    if (item.parentId === null) {
      continue;
    }
    const siblings = children.get(item.parentId) ?? [];
    siblings.push(item);
    children.set(item.parentId, siblings);
  }
  const found: MindMapNode[] = [];
  const queue = [...(children.get(node.id) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    found.push(current);
    queue.push(...(children.get(current.id) ?? []));
  }
  return found;
}

/** What a branch has settled, so a topic is never described as undecided while
 *  one of its children is a decision. */
export function summarizeMindMapBranch(
  node: MindMapNode,
  nodes: readonly MindMapNode[]
): MindMapBranchSummary {
  const live = descendantsOf(node, nodes).filter(
    (item) => item.status !== "superseded"
  );
  return {
    decisions: live.filter((item) => item.kind === "decision"),
    adopted: live.filter(
      (item) => item.kind === "proposal" && item.status === "decided"
    ),
    actions: live.filter((item) => item.kind === "action"),
    openCount: live.filter(
      (item) =>
        (item.kind === "topic" || item.kind === "proposal") &&
        item.status === "open"
    ).length,
  };
}

/** One glance for the whole map: what was decided and what comes next. */
export function summarizeMindMapDecisions(nodes: readonly MindMapNode[]): {
  decided: MindMapNode[];
  actions: MindMapNode[];
} {
  const live = nodes.filter((item) => item.status !== "superseded");
  const decisions = live.filter((item) => item.kind === "decision");
  const adopted = live.filter(
    (item) => item.kind === "proposal" && item.status === "decided"
  );
  return {
    decided: decisions.length > 0 ? decisions : adopted,
    actions: live.filter((item) => item.kind === "action"),
  };
}
