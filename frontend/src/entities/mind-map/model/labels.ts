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
  superseded: "言いなおし前",
};

/** A proposal that was decided on reads as "adopted" rather than a second 決定. */
export const MIND_MAP_ADOPTED_LABEL = "採用";

export const MIND_MAP_RELATION_LABELS: Record<MindMapRelationKind, string> = {
  supports: "賛成",
  opposes: "反対",
  supersedes: "言いなおし",
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
