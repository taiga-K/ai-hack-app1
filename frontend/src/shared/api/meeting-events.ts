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

export type MeetingServerEvent = UtteranceEvent | AdviceEvent | PongEvent;

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

  return null;
}
