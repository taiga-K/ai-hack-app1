const FLOOR_SNAPSHOT_PREFIX = "return-to-meeting:floor-snapshot:";

export type FloorSpeaker = "local_pm" | "remote_client";

export interface FloorUtterance {
  id: string;
  meetingId: string;
  speaker: FloorSpeaker;
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  createdAt: string;
}

export interface FloorAdvice {
  id: string;
  meetingId: string;
  category:
    | "ambiguity"
    | "contradiction"
    | "infeasibility"
    | "missing"
    | "unexplained_jargon"
    | "unknown";
  priority: "high" | "medium" | "low";
  title: string;
  reason: string;
  suggestedQuestion: string;
  detectedAt: string;
  quote: string | null;
}

export interface MeetingFloorSnapshot {
  ended: boolean;
  utterances: FloorUtterance[];
  adviceItems: FloorAdvice[];
}

export function floorSnapshotStorageKey(meetingId: string): string {
  return `${FLOOR_SNAPSHOT_PREFIX}${meetingId}`;
}

function readWebStorage(
  name: "sessionStorage" | "localStorage"
): Storage | null {
  if (typeof globalThis[name] === "undefined") {
    return null;
  }
  try {
    return globalThis[name];
  } catch {
    return null;
  }
}

function sessionStorageOrNull(): Storage | null {
  return readWebStorage("sessionStorage");
}

function forgetLocalFloorSnapshot(meetingId: string): void {
  const local = readWebStorage("localStorage");
  if (local === null) {
    return;
  }
  try {
    local.removeItem(floorSnapshotStorageKey(meetingId));
  } catch {
    return;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSpeaker(value: unknown): FloorSpeaker | null {
  if (value === "local_pm" || value === "remote_client") {
    return value;
  }
  return null;
}

function parseAdviceCategory(value: unknown): FloorAdvice["category"] {
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

function parseAdvicePriority(value: unknown): FloorAdvice["priority"] {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

function parseUtterance(value: unknown): FloorUtterance | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const meetingId = asString(value.meetingId);
  const speaker = parseSpeaker(value.speaker);
  const text = asString(value.text);
  const startMs = asFiniteNumber(value.startMs);
  const endMs = asFiniteNumber(value.endMs);
  const createdAt = asString(value.createdAt);
  if (
    id === null ||
    meetingId === null ||
    speaker === null ||
    text === null ||
    startMs === null ||
    endMs === null ||
    createdAt === null
  ) {
    return null;
  }
  return {
    id,
    meetingId,
    speaker,
    text,
    startMs,
    endMs,
    isFinal: value.isFinal === false ? false : true,
    createdAt,
  };
}

function parseAdvice(value: unknown): FloorAdvice | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const meetingId = asString(value.meetingId);
  const title = asString(value.title);
  const reason = asString(value.reason);
  const suggestedQuestion = asString(value.suggestedQuestion);
  const detectedAt = asString(value.detectedAt);
  if (
    id === null ||
    meetingId === null ||
    title === null ||
    reason === null ||
    suggestedQuestion === null ||
    detectedAt === null
  ) {
    return null;
  }
  const quoteValue = value.quote;
  return {
    id,
    meetingId,
    category: parseAdviceCategory(value.category),
    priority: parseAdvicePriority(value.priority),
    title,
    reason,
    suggestedQuestion,
    detectedAt,
    quote:
      typeof quoteValue === "string" && quoteValue.length > 0
        ? quoteValue
        : null,
  };
}

export function parseMeetingFloorSnapshot(
  raw: string | null
): MeetingFloorSnapshot | null {
  if (raw === null || raw.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.utterances) ||
      !Array.isArray(parsed.adviceItems)
    ) {
      return null;
    }

    const utterances: FloorUtterance[] = [];
    for (const item of parsed.utterances) {
      const utterance = parseUtterance(item);
      if (utterance !== null) {
        utterances.push(utterance);
      }
    }

    const adviceItems: FloorAdvice[] = [];
    for (const item of parsed.adviceItems) {
      const advice = parseAdvice(item);
      if (advice !== null) {
        adviceItems.push(advice);
      }
    }

    return {
      ended: parsed.ended === true,
      utterances,
      adviceItems,
    };
  } catch {
    return null;
  }
}

export function readMeetingFloorSnapshot(
  meetingId: string
): MeetingFloorSnapshot | null {
  forgetLocalFloorSnapshot(meetingId);
  const session = sessionStorageOrNull();
  if (session === null) {
    return null;
  }
  return parseMeetingFloorSnapshot(
    session.getItem(floorSnapshotStorageKey(meetingId))
  );
}

export function writeMeetingFloorSnapshot(
  meetingId: string,
  snapshot: MeetingFloorSnapshot
): void {
  forgetLocalFloorSnapshot(meetingId);
  const session = sessionStorageOrNull();
  if (session === null) {
    return;
  }
  session.setItem(floorSnapshotStorageKey(meetingId), JSON.stringify(snapshot));
}

export function clearMeetingFloorSnapshot(meetingId: string): void {
  forgetLocalFloorSnapshot(meetingId);
  const session = sessionStorageOrNull();
  if (session === null) {
    return;
  }
  session.removeItem(floorSnapshotStorageKey(meetingId));
}
