import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADVICE_ACTION_LABELS,
  getAdviceActionLabel,
  getAdviceActionVariant,
} from "./actions.ts";

describe("advice actions", () => {
  it("keeps first-look Japanese labels", () => {
    assert.equal(ADVICE_ACTION_LABELS.heard, "聞けた");
    assert.equal(ADVICE_ACTION_LABELS.unneeded, "不要");
    assert.equal(ADVICE_ACTION_LABELS.later, "あとで");
    assert.equal(getAdviceActionLabel("heard"), "聞けた");
    assert.equal(getAdviceActionLabel("unneeded"), "不要");
    assert.equal(getAdviceActionLabel("later"), "あとで");
  });

  it("makes 聞けた the filled action", () => {
    assert.equal(getAdviceActionVariant("heard"), "default");
    assert.equal(getAdviceActionVariant("unneeded"), "outline");
    assert.equal(getAdviceActionVariant("later"), "ghost");
  });
});
