const DRAFT_PREFIX = "requirement-draft:";

function draftKey(meetingId: string): string {
  return `${DRAFT_PREFIX}${meetingId}`;
}

function getLocalStorage(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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

export function readDocumentDraft(meetingId: string): string | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }
  return storage.getItem(draftKey(meetingId));
}

export function writeDocumentDraft(meetingId: string, markdown: string): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  storage.setItem(draftKey(meetingId), markdown);
}
