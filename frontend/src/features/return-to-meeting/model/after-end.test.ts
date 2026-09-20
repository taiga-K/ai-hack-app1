import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideAfterEndNavigation,
  shouldShowAfterEndBack,
  SHOW_STOP_WAITING_AFTER_MS,
} from "./after-end.ts";

describe("decideAfterEndNavigation", () => {
  it("opens the summary only while the meeting page is still open", () => {
    assert.equal(decideAfterEndNavigation(true), "open-document");
  });

  it("does not force the summary after the user left the meeting page", () => {
    assert.equal(decideAfterEndNavigation(false), "stay-put");
  });
});

describe("shouldShowAfterEndBack", () => {
  it("hides back while the requirements doc is being made", () => {
    assert.equal(shouldShowAfterEndBack("making"), false);
  });

  it("hides back while the ready announcement is on screen", () => {
    assert.equal(shouldShowAfterEndBack("ready"), false);
  });

  it("does not put back on the live floor through the after-end handoff", () => {
    assert.equal(shouldShowAfterEndBack("none"), false);
  });
});

describe("SHOW_STOP_WAITING_AFTER_MS", () => {
  it("waits several seconds before offering to stop a long generate", () => {
    assert.equal(SHOW_STOP_WAITING_AFTER_MS, 8_000);
  });
});
