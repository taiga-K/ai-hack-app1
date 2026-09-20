const DRAFT_PREFIX = "requirement-draft:";

export interface DocumentDraftSource {
  documentId: string;
  createdAt: string;
}

export interface DocumentDraft {
  markdown: string;
  sourceDocumentId: string;
  sourceCreatedAt: string;
}

function draftKey(meetingId: string): string {
  return `${DRAFT_PREFIX}${meetingId}`;
}

function getLocalStorage(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
} | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

function parseDraft(raw: string | null): DocumentDraft | null {
  if (raw === null || raw.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "markdown" in parsed &&
      "sourceDocumentId" in parsed &&
      "sourceCreatedAt" in parsed
    ) {
      const markdown = parsed.markdown;
      const sourceDocumentId = parsed.sourceDocumentId;
      const sourceCreatedAt = parsed.sourceCreatedAt;
      if (
        typeof markdown === "string" &&
        typeof sourceDocumentId === "string" &&
        typeof sourceCreatedAt === "string"
      ) {
        return { markdown, sourceDocumentId, sourceCreatedAt };
      }
    }
  } catch {
    return {
      markdown: raw,
      sourceDocumentId: "",
      sourceCreatedAt: "",
    };
  }

  return {
    markdown: raw,
    sourceDocumentId: "",
    sourceCreatedAt: "",
  };
}

export function readDocumentDraft(meetingId: string): DocumentDraft | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }
  return parseDraft(storage.getItem(draftKey(meetingId)));
}

export function writeDocumentDraft(
  meetingId: string,
  markdown: string,
  source: DocumentDraftSource
): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  const draft: DocumentDraft = {
    markdown,
    sourceDocumentId: source.documentId,
    sourceCreatedAt: source.createdAt,
  };
  storage.setItem(draftKey(meetingId), JSON.stringify(draft));
}

export function clearDocumentDraft(meetingId: string): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(draftKey(meetingId));
}

export function draftMatchesSource(
  draft: DocumentDraft | null,
  source: DocumentDraftSource
): boolean {
  if (draft === null) {
    return false;
  }
  return (
    draft.sourceDocumentId === source.documentId &&
    draft.sourceCreatedAt === source.createdAt
  );
}
