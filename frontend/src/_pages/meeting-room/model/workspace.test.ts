import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mindMapPlaceLabel } from "./workspace.ts";

describe("mindMapPlaceLabel", () => {
  it("returns the root label so the map place can stay visible", () => {
    assert.equal(mindMapPlaceLabel([]), null);
    assert.equal(
      mindMapPlaceLabel([
        { label: "対象範囲", parentId: "root" },
        { label: "今日の会議", parentId: null },
      ]),
      "今日の会議"
    );
  });
});
