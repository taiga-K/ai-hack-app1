import type {
  FinalizeAdviceInput,
  FinalizeRequirementDocumentInput,
  RequirementDocument,
  RequirementSection,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSection(value: unknown): RequirementSection | null {
  if (!isRecord(value)) {
    return null;
  }

  const sectionId = asString(value.section_id);
  const heading = asString(value.heading);
  const bodyMarkdown = asString(value.body_markdown);
  if (sectionId === null || heading === null || bodyMarkdown === null) {
    return null;
  }

  return {
    sectionId,
    heading,
    bodyMarkdown,
  };
}

export function parseRequirementDocument(
  payload: unknown
): RequirementDocument | null {
  if (!isRecord(payload)) {
    return null;
  }

  const id = asString(payload.id);
  const meetingId = asString(payload.meeting_id);
  const title = asString(payload.title);
  const markdown = asString(payload.markdown);
  const createdAt = asString(payload.created_at);
  const model = asString(payload.model);
  const sourceUtteranceCount = asNumber(payload.source_utterance_count);
  const sourceDetectionCount = asNumber(payload.source_detection_count);

  if (
    id === null ||
    meetingId === null ||
    title === null ||
    markdown === null ||
    createdAt === null ||
    model === null ||
    sourceUtteranceCount === null ||
    sourceDetectionCount === null ||
    !Array.isArray(payload.sections)
  ) {
    return null;
  }

  const sections = payload.sections
    .map(parseSection)
    .filter((section): section is RequirementSection => section !== null);

  return {
    id,
    meetingId,
    title,
    markdown,
    sections,
    createdAt,
    model,
    sourceUtteranceCount,
    sourceDetectionCount,
  };
}

export function toFinalizeRequestBody(
  input: FinalizeRequirementDocumentInput
): Record<string, unknown> {
  return {
    title: input.title ?? null,
    utterances: input.utterances.slice(0, 500),
    advice_items: input.adviceItems.slice(0, 200).map((item) => ({
      category: item.category.slice(0, 64),
      priority: item.priority.slice(0, 16),
      title: item.title.slice(0, 500),
      reason: item.reason.slice(0, 2000),
      suggested_question: item.suggestedQuestion.slice(0, 2000),
      quote: item.quote === null ? null : item.quote.slice(0, 2000),
      id: item.id,
    })),
  };
}

export function toFinalizeUtteranceLine(
  speaker: "local_pm" | "remote_client",
  text: string
): string {
  const label = speaker === "local_pm" ? "自社PM" : "相手クライアント";
  return `[${label}] ${text}`.slice(0, 2000);
}

export function toFinalizeAdviceInput(input: {
  category: string;
  priority: string;
  title: string;
  reason: string;
  suggestedQuestion: string;
  quote: string | null;
  id: string;
}): FinalizeAdviceInput {
  return {
    category: input.category,
    priority: input.priority,
    title: input.title,
    reason: input.reason,
    suggestedQuestion: input.suggestedQuestion,
    quote: input.quote,
    id: input.id,
  };
}
