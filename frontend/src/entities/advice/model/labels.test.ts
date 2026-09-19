import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAdviceCategoryPresentation,
  getAdvicePriorityLabel,
} from "./labels.ts";

describe("advice labels", () => {
  it("presents unexplained_jargon as an in-house confirmation badge", () => {
    const presentation = getAdviceCategoryPresentation("unexplained_jargon");
    assert.equal(presentation.badge, "❓ 専門用語の確認");
    assert.equal(presentation.label, "専門用語の確認");
    assert.notEqual(
      presentation.badge,
      getAdviceCategoryPresentation("ambiguity").badge
    );
  });

  it("covers every known category and priority", () => {
    assert.equal(
      getAdviceCategoryPresentation("contradiction").badge,
      "⚠️ 矛盾を検出"
    );
    assert.equal(
      getAdviceCategoryPresentation("ambiguity").badge,
      "❓ 曖昧さを確認"
    );
    assert.equal(getAdviceCategoryPresentation("missing").badge, "💡 質問提案");
    assert.equal(getAdvicePriorityLabel("high"), "高");
    assert.equal(getAdvicePriorityLabel("medium"), "中");
    assert.equal(getAdvicePriorityLabel("low"), "低");
  });
});
