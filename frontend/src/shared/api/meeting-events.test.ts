import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMeetingServerMessage } from "./meeting-events.ts";

describe("parseMeetingServerMessage", () => {
  it("parses a local PM utterance event", () => {
    const event = parseMeetingServerMessage({
      type: "utterance",
      id: "utt-1",
      meeting_id: "m-1",
      speaker: "local_pm",
      text: "納期は来月末で問題ないですか？",
      start_ms: 1200,
      end_ms: 3400,
      is_final: true,
      created_at: "2026-09-19T00:00:00.000Z",
    });

    assert.deepEqual(event, {
      type: "utterance",
      id: "utt-1",
      meetingId: "m-1",
      speaker: "local_pm",
      text: "納期は来月末で問題ないですか？",
      startMs: 1200,
      endMs: 3400,
      isFinal: true,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
  });

  it("parses unexplained_jargon advice for the in-house PM", () => {
    const event = parseMeetingServerMessage(
      JSON.stringify({
        type: "advice",
        id: "adv-1",
        meeting_id: "m-1",
        category: "unexplained_jargon",
        priority: "high",
        title: "専門用語の取り違えリスク",
        reason: "クライアントが「了解です」とだけ返しています。",
        suggested_question:
          "API連携とおっしゃった範囲は、既存システムの参照のみでしょうか？",
        detected_at: "2026-09-19T00:00:01.000Z",
        quote: "API連携でリアルタイムに同期します",
      })
    );

    assert.ok(event);
    assert.equal(event.type, "advice");
    if (event.type !== "advice") {
      return;
    }
    assert.equal(event.category, "unexplained_jargon");
    assert.equal(event.priority, "high");
    assert.equal(
      event.suggestedQuestion,
      "API連携とおっしゃった範囲は、既存システムの参照のみでしょうか？"
    );
    assert.equal(event.quote, "API連携でリアルタイムに同期します");
  });

  it("maps unknown advice categories instead of dropping the event", () => {
    const event = parseMeetingServerMessage({
      type: "advice",
      id: "adv-2",
      meeting_id: "m-1",
      category: "brand_new_signal",
      priority: "urgent",
      title: "新しい検出",
      reason: "将来のカテゴリ追加に備える",
      suggested_question: "この点を確認してよいですか？",
      detected_at: "2026-09-19T00:00:02.000Z",
    });

    assert.ok(event);
    assert.equal(event?.type, "advice");
    if (event?.type !== "advice") {
      return;
    }
    assert.equal(event.category, "unknown");
    assert.equal(event.priority, "medium");
  });

  it("parses pong and rejects invalid payloads", () => {
    assert.deepEqual(parseMeetingServerMessage({ type: "pong" }), {
      type: "pong",
    });
    assert.equal(parseMeetingServerMessage("{"), null);
    assert.equal(
      parseMeetingServerMessage({
        type: "utterance",
        id: "x",
        speaker: "unknown",
      }),
      null
    );
  });
});
