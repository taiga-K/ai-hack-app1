import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completedSummaryHref,
  isMeetingAlreadyOver,
  isMissingCompletedSummaryError,
  lookupCompletedSummary,
  mergeCompletedSummaryLookup,
  resolveImmediateCompletedSummary,
  shouldHintCompletedSummaryOnBack,
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

  it("does not lock a live meeting when the background fetch fails", () => {
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
  it("hides end controls while checking or on fetch error", () => {
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "checking",
        hasSessionDocument: false,
        phase: "idle",
      }),
      true
    );
    assert.equal(
      isMeetingAlreadyOver({
        lookupStatus: "error",
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
