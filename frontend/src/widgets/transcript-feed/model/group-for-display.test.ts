import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISPLAY_UTTERANCE_GAP_MS,
  groupUtterancesForDisplay,
  joinDisplayUtteranceText,
} from "./group-for-display.ts";

type DisplayUtterance = ReturnType<typeof groupUtterancesForDisplay>[number];

function utterance(
  overrides: Partial<DisplayUtterance> & Pick<DisplayUtterance, "id" | "text">
): DisplayUtterance {
  return {
    meetingId: "meet-1",
    speaker: "local_pm",
    startMs: 0,
    endMs: 800,
    isFinal: true,
    createdAt: "2026-09-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("joinDisplayUtteranceText", () => {
  it("concatenates Japanese fragments without inserting spaces", () => {
    assert.equal(joinDisplayUtteranceText("書く", "簡単に"), "書く簡単に");
    assert.equal(
      joinDisplayUtteranceText("書く簡単に", "のを"),
      "書く簡単にのを"
    );
  });

  it("puts a space only between ASCII tokens", () => {
    assert.equal(joinDisplayUtteranceText("API", "sync"), "API sync");
    assert.equal(joinDisplayUtteranceText("API", "連携"), "API連携");
  });
});

describe("groupUtterancesForDisplay", () => {
  it("keeps the 1s mind-map / 800ms STT cuts in one spoken line", () => {
    const lines = groupUtterancesForDisplay([
      utterance({
        id: "u-1",
        text: "書く",
        startMs: 12_000,
        endMs: 12_800,
      }),
      utterance({
        id: "u-2",
        text: "簡単に",
        startMs: 13_000,
        endMs: 13_700,
      }),
      utterance({
        id: "u-3",
        text: "のを",
        startMs: 14_000,
        endMs: 14_400,
      }),
      utterance({
        id: "u-4",
        text: "というのを",
        startMs: 15_000,
        endMs: 15_900,
      }),
    ]);

    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.id, "u-1");
    assert.equal(lines[0]?.text, "書く簡単にのをというのを");
    assert.equal(lines[0]?.startMs, 12_000);
    assert.equal(lines[0]?.endMs, 15_900);
    assert.equal(lines[0]?.isFinal, true);
  });

  it("starts a new row on speaker change even when the gap is 1 second", () => {
    const lines = groupUtterancesForDisplay([
      utterance({
        id: "ours",
        speaker: "local_pm",
        text: "対象範囲は更新申請だけですか？",
        startMs: 4000,
        endMs: 9000,
      }),
      utterance({
        id: "theirs",
        speaker: "remote_client",
        text: "はい。その理解で問題ありません。",
        startMs: 10_000,
        endMs: 14_000,
      }),
    ]);

    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.text, "対象範囲は更新申請だけですか？");
    assert.equal(lines[1]?.text, "はい。その理解で問題ありません。");
  });

  it("starts a new row after a pause longer than the display gap", () => {
    const lines = groupUtterancesForDisplay([
      utterance({
        id: "first",
        text: "予算は30万円です。",
        startMs: 1000,
        endMs: 4000,
      }),
      utterance({
        id: "later",
        text: "納期は来月末でお願いします。",
        startMs: 4000 + DISPLAY_UTTERANCE_GAP_MS + 1,
        endMs: 4000 + DISPLAY_UTTERANCE_GAP_MS + 2000,
      }),
    ]);

    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.text, "予算は30万円です。");
    assert.equal(lines[1]?.text, "納期は来月末でお願いします。");
  });

  it("keeps ききとり中 on a line that is still receiving fragments", () => {
    const lines = groupUtterancesForDisplay([
      utterance({
        id: "done",
        text: "書く",
        startMs: 1000,
        endMs: 1800,
        isFinal: true,
      }),
      utterance({
        id: "live",
        text: "簡単に",
        startMs: 2000,
        endMs: 2600,
        isFinal: false,
      }),
    ]);

    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.text, "書く簡単に");
    assert.equal(lines[0]?.isFinal, false);
  });

  it("does not invent a memo row when nobody has spoken", () => {
    assert.deepEqual(groupUtterancesForDisplay([]), []);
  });
});
