import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMobileSidePane } from "./workspace.ts";

describe("isMobileSidePane", () => {
  it("keeps notes and whispers as side panes beside the live map", () => {
    assert.equal(isMobileSidePane("notes"), true);
    assert.equal(isMobileSidePane("whispers"), true);
    assert.equal(isMobileSidePane("map"), false);
  });
});
