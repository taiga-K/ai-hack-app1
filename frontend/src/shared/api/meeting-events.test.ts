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

  it("parses a mindmap delta in revision order fields", () => {
    const event = parseMeetingServerMessage({
      type: "mindmap",
      meeting_id: "m-1",
      revision: 2,
      upserts: [
        {
          id: "scope",
          label: "対象範囲",
          parent_id: "root",
          kind: "decision",
          status: "decided",
          detail: "更新申請に限定",
          relations: [
            { kind: "supports", target_id: "renewal" },
            { kind: "hugs", target_id: "renewal" },
            { kind: "opposes" },
          ],
          history: ["対象", 3],
          pinned: true,
          source_utterance_ids: ["utt-1"],
        },
        {
          id: "legacy",
          label: "古い形の枚",
          parent_id: null,
          source_utterance_ids: [],
        },
      ],
      removes: ["noise"],
      pending: [
        { text: "例外の扱い", source_utterance_ids: ["utt-2"] },
        { text: "" },
        "not-an-object",
      ],
    });

    assert.deepEqual(event, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
        {
          id: "scope",
          label: "対象範囲",
          parentId: "root",
          kind: "decision",
          status: "decided",
          detail: "更新申請に限定",
          relations: [{ kind: "supports", targetId: "renewal" }],
          history: ["対象"],
          pinned: true,
          sourceUtteranceIds: ["utt-1"],
        },
        {
          id: "legacy",
          label: "古い形の枚",
          parentId: null,
          kind: "topic",
          status: "open",
          detail: "",
          relations: [],
          history: [],
          pinned: false,
          sourceUtteranceIds: [],
        },
      ],
      removes: ["noise"],
      pending: [{ text: "例外の扱い", sourceUtteranceIds: ["utt-2"] }],
    });
  });

  it("falls back to plain topics for unknown kinds and statuses", () => {
    const event = parseMeetingServerMessage({
      type: "mindmap",
      meeting_id: "m-1",
      revision: 1,
      upserts: [
        {
          id: "x",
          label: "新種",
          parent_id: "root",
          kind: "brand_new",
          status: "someday",
        },
      ],
    });

    assert.ok(event);
    assert.equal(event.type, "mindmap");
    if (event.type !== "mindmap") {
      return;
    }
    assert.equal(event.upserts[0]?.kind, "topic");
    assert.equal(event.upserts[0]?.status, "open");
    assert.deepEqual(event.pending, []);
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
