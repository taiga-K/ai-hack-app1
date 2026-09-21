import type {
  MindMapNodeKind,
  MindMapNodeStatus,
  MindMapRelationKind,
} from "@/shared/api";

export type { MindMapNodeKind, MindMapNodeStatus, MindMapRelationKind };

export interface MindMapRelation {
  kind: MindMapRelationKind;
  targetId: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  parentId: string | null;
  kind: MindMapNodeKind;
  status: MindMapNodeStatus;
  detail: string;
  relations: MindMapRelation[];
  history: string[];
  pinned: boolean;
  sourceUtteranceIds: string[];
}

export interface MindMapPendingItem {
  text: string;
  sourceUtteranceIds: string[];
}

export interface MindMapSnapshot {
  meetingId: string;
  revision: number;
  nodes: MindMapNode[];
  pending: MindMapPendingItem[];
}

export interface MindMapEvent {
  type: "mindmap";
  meetingId: string;
  revision: number;
  upserts: MindMapNode[];
  removes: string[];
  pending: MindMapPendingItem[];
}

export function createEmptyMindMap(meetingId: string): MindMapSnapshot {
  return {
    meetingId,
    revision: 0,
    nodes: [],
    pending: [],
  };
}

export function createMindMapNode(
  node: Pick<MindMapNode, "id" | "label" | "parentId"> &
    Partial<Omit<MindMapNode, "id" | "label" | "parentId">>
): MindMapNode {
  return {
    id: node.id,
    label: node.label,
    parentId: node.parentId,
    kind: node.kind ?? "topic",
    status: node.status ?? "open",
    detail: node.detail ?? "",
    relations: node.relations ?? [],
    history: node.history ?? [],
    pinned: node.pinned ?? false,
    sourceUtteranceIds: node.sourceUtteranceIds ?? [],
  };
}
