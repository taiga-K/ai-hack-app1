import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completedSummaryHref,
  forgetCompletedSummary,
  isMeetingAlreadyOver,
  shouldReopenLiveFloor,
  isMissingCompletedSummaryError,
  lookupCompletedSummary,
  mergeCompletedSummaryLookup,
  readRememberedCompletedSummary,
  rememberCompletedSummary,
  resolveImmediateCompletedSummary,
  shouldHintCompletedSummaryOnBack,
  syncCompletedSummaryMemory,
} from "./completed-summary.ts";
import { readCompletedSummaryQuery } from "./href.ts";
import type { CompletedSummaryLookup } from "./types.ts";

const documentHref = "/meetings/meet-1/document";

describe("readCompletedSummaryQuery", () => {
  it("treats summary=1 as a hint to verify a completed document", () => {
    assert.equal(readCompletedSummaryQuery("1"), true);
  });

  it("ignores missing or other values", () => {
    assert.equal(readCompletedSummaryQuery(undefined), false);
    assert.equal(readCompletedSummaryQuery("0"), false);
  });
});

describe("isMissingCompletedSummaryError", () => {
  it("treats only HTTP 404 as missing", () => {
    assert.equal(isMissingCompletedSummaryError({ status: 404 }), true);
    assert.equal(isMissingCompletedSummaryError({ status: 0 }), false);
    assert.equal(isMissingCompletedSummaryError({ status: 500 }), false);
    assert.equal(isMissingCompletedSummaryError(new Error("boom")), false);
  });
});

describe("lookupCompletedSummary", () => {
  it("returns found when the persisted document exists", async () => {
    const lookup = await lookupCompletedSummary(
      "meet-1",
      documentHref,
      async () => ({
        markdown: "# ok",
      })
    );
    assert.deepEqual(lookup, {
      status: "found",
      href: documentHref,
    });
  });

  it("returns missing only for 404", async () => {
    const lookup = await lookupCompletedSummary(
      "meet-1",
      documentHref,
      async () => {
        throw Object.assign(new Error("not found"), { status: 404 });
      }
    );
    assert.deepEqual(lookup, { status: "missing" });
  });

  it("returns error for other failures", async () => {
    const lookup = await lookupCompletedSummary(
      "meet-1",
      documentHref,
      async () => {
        throw Object.assign(new Error("down"), { status: 0 });
      }
    );
    assert.deepEqual(lookup, { status: "error" });
  });
});

describe("resolveImmediateCompletedSummary", () => {
  it("uses a remembered href as confirmation", () => {
    assert.deepEqual(
      resolveImmediateCompletedSummary({
        completedSummaryHint: false,
        rememberedHref: "/meetings/meet-1/document?title=today",
        hintedHref: documentHref,
      }),
      {
        status: "found",
        href: "/meetings/meet-1/document?title=today",
      }
    );
  });

  it("shows reopen immediately from the query hint, then verifies in the background", () => {
    assert.deepEqual(
      resolveImmediateCompletedSummary({
        completedSummaryHint: true,
        rememberedHref: null,
        hintedHref: documentHref,
      }),
      {
        status: "found",
        href: documentHref,
      }
    );
  });

  it("starts missing when there is no hint and no memory", () => {
    assert.deepEqual(
      resolveImmediateCompletedSummary({
        completedSummaryHint: false,
        rememberedHref: null,
        hintedHref: documentHref,
      }),
      { status: "missing" }
    );
  });

  it("starts checking when a live remount still needs verification", () => {
    assert.deepEqual(
      resolveImmediateCompletedSummary({
        completedSummaryHint: false,
        rememberedHref: null,
        hintedHref: documentHref,
        unverifiedLiveMeeting: true,
      }),
      { status: "checking" }
    );
  });
});

describe("mergeCompletedSummaryLookup", () => {
  const found: CompletedSummaryLookup = {
    status: "found",
    href: "/meetings/meet-1/document",
  };

  it("keeps a remembered found document when fetch errors", () => {
    assert.deepEqual(
      mergeCompletedSummaryLookup(found, { status: "error" }),
      found
    );
  });

  it("does not resurrect live controls when a check fails", () => {
    assert.deepEqual(
      mergeCompletedSummaryLookup({ status: "checking" }, { status: "error" }),
      { status: "error" }
    );
  });

  it("does not lock a meeting already known to be missing", () => {
    assert.deepEqual(
      mergeCompletedSummaryLookup({ status: "missing" }, { status: "error" }),
      { status: "missing" }
    );
  });

  it("lets a 404 clear a stale hint", () => {
    assert.deepEqual(
      mergeCompletedSummaryLookup(
        { status: "checking" },
        { status: "missing" }
      ),
      { status: "missing" }
    );
  });

  it("keeps checking until fetch returns", () => {
    assert.deepEqual(
      mergeCompletedSummaryLookup({ status: "checking" }, null),
      { status: "checking" }
    );
  });
});

describe("isMeetingAlreadyOver", () => {
  it("keeps live controls while checking or on fetch error", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "checking",
        hasSessionDocument: false,
        phase: "idle",
      }),
      false
    );
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "error",
        hasSessionDocument: false,
        phase: "idle",
      }),
      false
    );
  });

  it("hides end controls only after a completed summary is found", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "found",
        hasSessionDocument: false,
        phase: "idle",
      }),
      true
    );
  });

  it("keeps a live meeting live when the document is missing", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "missing",
        hasSessionDocument: false,
        phase: "idle",
      }),
      false
    );
  });

  it("treats a session document as already over", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "missing",
        hasSessionDocument: true,
        phase: "live",
      }),
      true
    );
  });

  it("reopens controls when an ended snapshot has no summary", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "missing",
        hasSessionDocument: false,
        phase: "ended",
      }),
      false
    );
  });

  it("hides controls while a summary is still being generated", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "missing",
        hasSessionDocument: false,
        phase: "finalizing",
      }),
      true
    );
  });

  it("keeps an ended remount over while the summary is still checking", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "checking",
        hasSessionDocument: false,
        phase: "ended",
      }),
      true
    );
  });
});

describe("shouldReopenLiveFloor", () => {
  it("reopens only an ended floor after a missing summary", () => {
    assert.equal(
      shouldReopenLiveFloor({
        lookupStatus: "missing",
        hasSessionDocument: false,
        hasFinalizeError: false,
        phase: "ended",
      }),
      true
    );
  });

  it("does not reopen a live floor or a failed finalize", () => {
    assert.equal(
      shouldReopenLiveFloor({
        lookupStatus: "missing",
        hasSessionDocument: false,
        hasFinalizeError: false,
        phase: "idle",
      }),
      false
    );
    assert.equal(
      shouldReopenLiveFloor({
        lookupStatus: "missing",
        hasSessionDocument: false,
        hasFinalizeError: true,
        phase: "ended",
      }),
      false
    );
    assert.equal(
      shouldReopenLiveFloor({
        lookupStatus: "found",
        hasSessionDocument: false,
        hasFinalizeError: false,
        phase: "ended",
      }),
      false
    );
    assert.equal(
      shouldReopenLiveFloor({
        lookupStatus: "missing",
        hasSessionDocument: false,
        hasFinalizeError: false,
        phase: "finalizing",
      }),
      false
    );
  });
});

describe("syncCompletedSummaryMemory", () => {
  function installMemoryStorages(): void {
    function makeStorage(): Storage {
      const store = new Map<string, string>();
      return {
        get length() {
          return store.size;
        },
        clear() {
          store.clear();
        },
        getItem(key: string) {
          return store.get(key) ?? null;
        },
        key(index: number) {
          return Array.from(store.keys())[index] ?? null;
        },
        removeItem(key: string) {
          store.delete(key);
        },
        setItem(key: string, value: string) {
          store.set(key, value);
        },
      };
    }

    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: makeStorage(),
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: makeStorage(),
    });
  }

  const target = {
    kind: "meeting" as const,
    meetingId: "meet-1",
    title: "今日の会議",
    preview: false,
  };

  it("persists only a ready document and clears an empty one", () => {
    installMemoryStorages();
    const key = "return-to-meeting:completed-summary:meet-1";

    syncCompletedSummaryMemory("loading", target, documentHref);
    assert.equal(globalThis.sessionStorage.getItem(key), null);

    syncCompletedSummaryMemory("ready", target, documentHref);
    assert.equal(globalThis.sessionStorage.getItem(key), documentHref);
    assert.equal(globalThis.localStorage.getItem(key), null);

    syncCompletedSummaryMemory("empty", target, documentHref);
    assert.equal(globalThis.sessionStorage.getItem(key), null);
    assert.equal(globalThis.localStorage.getItem(key), null);
  });

  it("keeps remembered hrefs in sessionStorage and deletes leftover local keys", () => {
    installMemoryStorages();
    const key = "return-to-meeting:completed-summary:meet-1";
    globalThis.localStorage.setItem(key, documentHref);

    rememberCompletedSummary(target, documentHref);
    assert.equal(globalThis.sessionStorage.getItem(key), documentHref);
    assert.equal(globalThis.localStorage.getItem(key), null);

    globalThis.localStorage.setItem(key, "/stale");
    assert.equal(readRememberedCompletedSummary("meet-1"), documentHref);
    assert.equal(globalThis.localStorage.getItem(key), null);

    globalThis.localStorage.setItem(key, "/stale");
    forgetCompletedSummary("meet-1");
    assert.equal(globalThis.sessionStorage.getItem(key), null);
    assert.equal(globalThis.localStorage.getItem(key), null);
  });

  it("does not treat an error as a completed summary", () => {
    installMemoryStorages();
    syncCompletedSummaryMemory("error", target, documentHref);
    assert.equal(
      globalThis.sessionStorage.getItem(
        "return-to-meeting:completed-summary:meet-1"
      ),
      null
    );
  });
});

describe("shouldHintCompletedSummaryOnBack", () => {
  it("keeps the meeting ended while the real document is still loading", () => {
    assert.equal(shouldHintCompletedSummaryOnBack("loading"), true);
    assert.equal(shouldHintCompletedSummaryOnBack("ready"), true);
    assert.equal(shouldHintCompletedSummaryOnBack("error"), true);
  });

  it("does not mark an empty document page as completed", () => {
    assert.equal(shouldHintCompletedSummaryOnBack("empty"), false);
  });
});

describe("completedSummaryHref", () => {
  it("exposes a document link only after the summary is found", () => {
    assert.equal(completedSummaryHref({ status: "checking" }), null);
    assert.equal(completedSummaryHref({ status: "missing" }), null);
    assert.equal(completedSummaryHref({ status: "error" }), null);
    assert.equal(
      completedSummaryHref({
        status: "found",
        href: "/meetings/meet-1/document",
      }),
      "/meetings/meet-1/document"
    );
  });
});
