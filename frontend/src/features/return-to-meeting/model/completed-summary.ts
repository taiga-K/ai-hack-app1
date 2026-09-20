import type {
  BackTarget,
  CompletedSummaryLookup,
  CompletedSummaryStatus,
} from "./types";

const REMEMBERED_SUMMARY_PREFIX = "return-to-meeting:completed-summary:";

export function completedSummaryStorageKey(meetingId: string): string {
  return `${REMEMBERED_SUMMARY_PREFIX}${meetingId}`;
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

function completedSummaryStorages(): Storage[] {
  const storages: Storage[] = [];
  const session = readWebStorage("sessionStorage");
  const local = readWebStorage("localStorage");
  if (session !== null) {
    storages.push(session);
  }
  if (local !== null) {
    storages.push(local);
  }
  return storages;
}

export function rememberCompletedSummary(
  target: BackTarget,
  href: string
): void {
  const key = completedSummaryStorageKey(target.meetingId);
  for (const storage of completedSummaryStorages()) {
    storage.setItem(key, href);
  }
}

export function readRememberedCompletedSummary(
  meetingId: string
): string | null {
  const key = completedSummaryStorageKey(meetingId);
  for (const storage of completedSummaryStorages()) {
    const href = storage.getItem(key);
    if (href !== null) {
      return href;
    }
  }
  return null;
}

export function forgetCompletedSummary(meetingId: string): void {
  const key = completedSummaryStorageKey(meetingId);
  for (const storage of completedSummaryStorages()) {
    storage.removeItem(key);
  }
}

function readErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return null;
  }
  return typeof error.status === "number" ? error.status : null;
}

export function isMissingCompletedSummaryError(error: unknown): boolean {
  return readErrorStatus(error) === 404;
}

export async function lookupCompletedSummary(
  meetingId: string,
  documentHref: string,
  loadDocument: (id: string) => Promise<unknown>
): Promise<CompletedSummaryLookup> {
  try {
    await loadDocument(meetingId);
    return { status: "found", href: documentHref };
  } catch (error) {
    if (isMissingCompletedSummaryError(error)) {
      return { status: "missing" };
    }
    return { status: "error" };
  }
}

export type DocumentBackStatus = "loading" | "ready" | "empty" | "error";

export function syncCompletedSummaryMemory(
  status: DocumentBackStatus,
  target: BackTarget,
  documentHref: string
): void {
  switch (status) {
    case "ready":
      rememberCompletedSummary(
        { ...target, hasCompletedSummary: true },
        documentHref
      );
      return;
    case "empty":
      forgetCompletedSummary(target.meetingId);
      return;
    case "loading":
    case "error":
      return;
    default: {
      const _exhaustiveCheck: never = status;
      throw new Error(`Unhandled document status: ${_exhaustiveCheck}`);
    }
  }
}

export function shouldHintCompletedSummaryOnBack(
  status: DocumentBackStatus
): boolean {
  switch (status) {
    case "loading":
    case "ready":
    case "error":
      return true;
    case "empty":
      return false;
    default: {
      const _exhaustiveCheck: never = status;
      throw new Error(`Unhandled document back status: ${_exhaustiveCheck}`);
    }
  }
}

export function resolveImmediateCompletedSummary(input: {
  completedSummaryHint: boolean;
  rememberedHref: string | null;
  hintedHref: string;
  unverifiedLiveMeeting?: boolean;
}): CompletedSummaryLookup {
  if (input.rememberedHref !== null) {
    return { status: "found", href: input.rememberedHref };
  }
  if (input.completedSummaryHint) {
    return { status: "found", href: input.hintedHref };
  }
  if (input.unverifiedLiveMeeting === true) {
    return { status: "checking" };
  }
  return { status: "missing" };
}

export function mergeCompletedSummaryLookup(
  immediate: CompletedSummaryLookup,
  fetched: CompletedSummaryLookup | null
): CompletedSummaryLookup {
  if (fetched === null) {
    return immediate;
  }
  switch (fetched.status) {
    case "found":
    case "missing":
      return fetched;
    case "checking":
      return immediate;
    case "error":
      if (immediate.status === "found") {
        return immediate;
      }
      if (immediate.status === "checking") {
        return fetched;
      }
      return immediate;
    default: {
      const _exhaustiveCheck: never = fetched;
      throw new Error(`Unhandled lookup status: ${_exhaustiveCheck}`);
    }
  }
}

export function isMeetingAlreadyOver(input: {
  lookupStatus: CompletedSummaryStatus;
  hasSessionDocument: boolean;
  phase: "idle" | "live" | "finalizing" | "ended";
}): boolean {
  if (input.hasSessionDocument) {
    return true;
  }
  if (input.phase === "ended" || input.phase === "finalizing") {
    return true;
  }
  switch (input.lookupStatus) {
    case "found":
      return true;
    case "checking":
    case "error":
    case "missing":
      return false;
    default: {
      const _exhaustiveCheck: never = input.lookupStatus;
      throw new Error(`Unhandled lookup status: ${_exhaustiveCheck}`);
    }
  }
}

export function completedSummaryHref(
  lookup: CompletedSummaryLookup
): string | null {
  return lookup.status === "found" ? lookup.href : null;
}
