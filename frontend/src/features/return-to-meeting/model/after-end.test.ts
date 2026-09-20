import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideAfterFinalize, decideAfterReadyPause } from "./after-end.ts";

describe("decideAfterFinalize", () => {
  it("stays on the meeting floor when the user already went back", () => {
    assert.equal(decideAfterFinalize(true), "stay-on-floor");
  });

  it("announces the ready screen when the user is still waiting", () => {
    assert.equal(decideAfterFinalize(false), "announce-ready");
  });
});

describe("decideAfterReadyPause", () => {
  it("does not auto-open the summary after a back tap", () => {
    assert.equal(decideAfterReadyPause(true), "stay-on-floor");
  });

  it("opens the summary when the user stayed on the confirm screen", () => {
    assert.equal(decideAfterReadyPause(false), "open-document");
  });
});
