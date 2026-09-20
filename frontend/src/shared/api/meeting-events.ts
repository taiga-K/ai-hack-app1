export const SPEAKERS = ["local_pm", "remote_client"] as const;
export type SpeakerId = (typeof SPEAKERS)[number];

export const ADVICE_CATEGORIES = [
  "ambiguity",
  "contradiction",
  "infeasibility",
  "missing",
  "unexplained_jargon",
  "unknown",
] as const;
export type AdviceCategory = (typeof ADVICE_CATEGORIES)[number];

export const ADVICE_PRIORITIES = ["high", "medium", "low"] as const;
export type AdvicePriority = (typeof ADVICE_PRIORITIES)[number];

export interface UtteranceEvent {
  type: "utterance";
  id: string;
  meetingId: string;
  speaker: SpeakerId;
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  createdAt: string;
}

export interface AdviceEvent {
  type: "advice";
  id: string;
  meetingId: string;
  category: AdviceCategory;
  priority: AdvicePriority;
  title: string;
  reason: string;
  suggestedQuestion: string;
  detectedAt: string;
  quote: string | null;
}

export interface PongEvent {
  type: "pong";
}

export const MIND_MAP_NODE_KINDS = [
  "topic",
  "report",
  "proposal",
  "reason",
  "concern",
  "decision",
  "action",
] as const;
export type MindMapNodeKind = (typeof MIND_MAP_NODE_KINDS)[number];

export const MIND_MAP_NODE_STATUSES = [
  "open",
  "decided",
  "pending",
  "superseded",
] as const;
export type MindMapNodeStatus = (typeof MIND_MAP_NODE_STATUSES)[number];

export const MIND_MAP_RELATION_KINDS = [
  "supports",
  "opposes",
  "supersedes",
] as const;
export type MindMapRelationKind = (typeof MIND_MAP_RELATION_KINDS)[number];

export interface MindMapRelationPayload {
  kind: MindMapRelationKind;
  targetId: string;
}

export interface MindMapNodePayload {
  id: string;
  label: string;
  parentId: string | null;
  kind: MindMapNodeKind;
  status: MindMapNodeStatus;
  detail: string;
  relations: MindMapRelationPayload[];
  history: string[];
  pinned: boolean;
  sourceUtteranceIds: string[];
}

export interface MindMapPendingPayload {
  text: string;
  sourceUtteranceIds: string[];
}

export interface MindMapEvent {
  type: "mindmap";
  meetingId: string;
  revision: number;
  upserts: MindMapNodePayload[];
  removes: string[];
  pending: MindMapPendingPayload[];
}

export type MeetingServerEvent =
  UtteranceEvent | AdviceEvent | MindMapEvent | PongEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function toMindMapNodeKind(value: unknown): MindMapNodeKind {
  const match = MIND_MAP_NODE_KINDS.find((kind) => kind === value);
  return match ?? "topic";
}

function toMindMapNodeStatus(value: unknown): MindMapNodeStatus {
  const match = MIND_MAP_NODE_STATUSES.find((status) => status === value);
  return match ?? "open";
}

function parseMindMapRelation(value: unknown): MindMapRelationPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = MIND_MAP_RELATION_KINDS.find((item) => item === value.kind);
  const targetId = asString(value.target_id);
  if (kind === undefined || targetId === null) {
    return null;
  }
  return { kind, targetId };
}

function parseMindMapNode(value: unknown): MindMapNodePayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const label = asString(value.label);
  if (id === null || label === null) {
    return null;
  }
  const parentRaw = value.parent_id;
  const parentId =
    typeof parentRaw === "string" && parentRaw.length > 0 ? parentRaw : null;
  const relations = Array.isArray(value.relations)
    ? value.relations
        .map((item) => parseMindMapRelation(item))
        .filter((item): item is MindMapRelationPayload => item !== null)
    : [];
  return {
    id,
    label,
    parentId,
    kind: toMindMapNodeKind(value.kind),
    status: toMindMapNodeStatus(value.status),
    detail: typeof value.detail === "string" ? value.detail : "",
    relations,
    history: asStringList(value.history),
    pinned: asBoolean(value.pinned, false),
    sourceUtteranceIds: asStringList(value.source_utterance_ids),
  };
}

function parseMindMapPending(value: unknown): MindMapPendingPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const text = asString(value.text);
  if (text === null) {
    return null;
  }
  return {
    text,
    sourceUtteranceIds: asStringList(value.source_utterance_ids),
  };
}

function isSpeakerId(value: unknown): value is SpeakerId {
  return value === "local_pm" || value === "remote_client";
}

function toAdviceCategory(value: unknown): AdviceCategory {
  if (
    value === "ambiguity" ||
    value === "contradiction" ||
    value === "infeasibility" ||
    value === "missing" ||
    value === "unexplained_jargon"
  ) {
    return value;
  }
  return "unknown";
}

function toAdvicePriority(value: unknown): AdvicePriority {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

function toIsoString(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

export function parseMeetingServerMessage(
  data: unknown
): MeetingServerEvent | null {
  let payload: unknown = data;

  if (typeof data === "string") {
    try {
      payload = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (!isRecord(payload)) {
    return null;
  }

  const type = payload.type;
  if (type === "pong") {
    return { type: "pong" };
  }

  if (type === "utterance") {
    const id = asString(payload.id);
    const meetingId = asString(payload.meeting_id);
    const text = asString(payload.text);
    const startMs = asNumber(payload.start_ms);
    const endMs = asNumber(payload.end_ms);
    if (
      id === null ||
      meetingId === null ||
      text === null ||
      startMs === null ||
      endMs === null ||
      !isSpeakerId(payload.speaker)
    ) {
      return null;
    }

    return {
      type: "utterance",
      id,
      meetingId,
      speaker: payload.speaker,
      text,
      startMs,
      endMs,
      isFinal: asBoolean(payload.is_final, true),
      createdAt: toIsoString(payload.created_at),
    };
  }

  if (type === "advice") {
    const id = asString(payload.id);
    const meetingId = asString(payload.meeting_id);
    const title = asString(payload.title);
    const reason = asString(payload.reason);
    const suggestedQuestion = asString(payload.suggested_question);
    if (
      id === null ||
      meetingId === null ||
      title === null ||
      reason === null ||
      suggestedQuestion === null
    ) {
      return null;
    }

    const quoteValue = payload.quote;
    const quote =
      typeof quoteValue === "string" && quoteValue.length > 0
        ? quoteValue
        : null;

    return {
      type: "advice",
      id,
      meetingId,
      category: toAdviceCategory(payload.category),
      priority: toAdvicePriority(payload.priority),
      title,
      reason,
      suggestedQuestion,
      detectedAt: toIsoString(payload.detected_at),
      quote,
    };
  }

  if (type === "mindmap") {
    const meetingId = asString(payload.meeting_id);
    const revision = asNumber(payload.revision);
    if (meetingId === null || revision === null) {
      return null;
    }
    const upsertsRaw = payload.upserts;
    const removesRaw = payload.removes;
    const upserts = Array.isArray(upsertsRaw)
      ? upsertsRaw
          .map((item) => parseMindMapNode(item))
          .filter((item): item is MindMapNodePayload => item !== null)
      : [];
    const removes = asStringList(removesRaw);
    const pendingRaw = payload.pending;
    const pending = Array.isArray(pendingRaw)
      ? pendingRaw
          .map((item) => parseMindMapPending(item))
          .filter((item): item is MindMapPendingPayload => item !== null)
      : [];
    return {
      type: "mindmap",
      meetingId,
      revision,
      upserts,
      removes,
      pending,
    };
  }

  return null;
}
