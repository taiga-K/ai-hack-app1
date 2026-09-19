import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseRequirementDocument,
  toFinalizeRequestBody,
  toFinalizeUtteranceLine,
  uniqueFinalizeAdviceItems,
  uniqueFinalizeUtteranceLines,
} from "./parse.ts";

describe("parseRequirementDocument", () => {
  it("maps snake_case API JSON to the requirement document model", () => {
    const document = parseRequirementDocument({
      id: "doc-1",
      meeting_id: "meet-1",
      title: "要件定義書",
      markdown: "# 要件定義書\n",
      sections: [
        {
          section_id: "open_issues",
          heading: "6. 未決事項（ToDo / 宿題）・確認中リスク一覧",
          body_markdown: "- 納期の前提を確認する",
        },
      ],
      created_at: "2026-09-19T00:00:00.000Z",
      model: "anthropic/claude-3-5-sonnet",
      source_utterance_count: 4,
      source_detection_count: 2,
    });

    assert.deepEqual(document, {
      id: "doc-1",
      meetingId: "meet-1",
      title: "要件定義書",
      markdown: "# 要件定義書\n",
      sections: [
        {
          sectionId: "open_issues",
          heading: "6. 未決事項（ToDo / 宿題）・確認中リスク一覧",
          bodyMarkdown: "- 納期の前提を確認する",
        },
      ],
      createdAt: "2026-09-19T00:00:00.000Z",
      model: "anthropic/claude-3-5-sonnet",
      sourceUtteranceCount: 4,
      sourceDetectionCount: 2,
    });
  });

  it("rejects a payload without markdown", () => {
    const document = parseRequirementDocument({
      id: "doc-1",
      meeting_id: "meet-1",
      title: "要件定義書",
      sections: [],
      created_at: "2026-09-19T00:00:00.000Z",
      model: "anthropic/claude-3-5-sonnet",
      source_utterance_count: 0,
      source_detection_count: 0,
    });

    assert.equal(document, null);
  });
});

describe("finalize request mapping", () => {
  it("formats utterance lines for the existing finalize contract", () => {
    assert.equal(
      toFinalizeUtteranceLine("local_pm", "対象範囲は更新申請だけですか？"),
      "[自社PM] 対象範囲は更新申請だけですか？"
    );
    assert.equal(
      toFinalizeUtteranceLine("remote_client", "了解です"),
      "[相手クライアント] 了解です"
    );
  });

  it("serializes advice items with the backend field names", () => {
    const body = toFinalizeRequestBody({
      title: "初回ヒアリング",
      utterances: ["[自社PM] 確認です"],
      adviceItems: [
        {
          category: "unexplained_jargon",
          priority: "high",
          title: "専門用語の取り違え",
          reason: "曖昧な了解のみ",
          suggestedQuestion: "接続口という意味で合っていますか？",
          quote: "API連携",
          id: "adv-1",
        },
      ],
    });

    assert.deepEqual(body, {
      title: "初回ヒアリング",
      utterances: ["[自社PM] 確認です"],
      advice_items: [
        {
          category: "unexplained_jargon",
          priority: "high",
          title: "専門用語の取り違え",
          reason: "曖昧な了解のみ",
          suggested_question: "接続口という意味で合っていますか？",
          quote: "API連携",
          id: "adv-1",
        },
      ],
    });
  });

  it("drops duplicate utterance lines even when speaker labels differ", () => {
    assert.deepEqual(
      uniqueFinalizeUtteranceLines([
        "[自社PM] 対象範囲は更新申請だけですか？",
        "[local_pm] 対象範囲は更新申請だけですか？",
        "[相手クライアント] 了解です",
      ]),
      ["[自社PM] 対象範囲は更新申請だけですか？", "[相手クライアント] 了解です"]
    );
  });

  it("drops duplicate advice by id or content", () => {
    const first = {
      category: "unexplained_jargon",
      priority: "high",
      title: "専門用語の取り違え",
      reason: "曖昧な了解のみ",
      suggestedQuestion: "接続口という意味で合っていますか？",
      quote: "API連携",
      id: "adv-1",
    };

    assert.deepEqual(
      uniqueFinalizeAdviceItems([
        first,
        { ...first, reason: "同じ検出の再送" },
        { ...first, id: "adv-2", title: "別件" },
      ]),
      [first, { ...first, id: "adv-2", title: "別件" }]
    );
  });
});
