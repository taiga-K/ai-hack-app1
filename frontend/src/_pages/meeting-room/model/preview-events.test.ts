import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPreviewAdvice } from "./preview-events.ts";

describe("preview advice", () => {
  it("gives the in-house PM a plain-language jargon confirmation question", () => {
    const jargon = createPreviewAdvice("m-1").find(
      (item) => item.category === "unexplained_jargon"
    );

    assert.ok(jargon);
    assert.match(jargon.suggestedQuestion, /API連携/);
    assert.match(jargon.suggestedQuestion, /ですか？/);
    assert.equal(jargon.suggestedQuestion.includes("リアルタイム同期"), true);
  });
});
