import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findOpenIssuesSection,
  hasConcreteOpenIssues,
  isOpenIssuesHeading,
  listOpenIssueItems,
  listOpenIssueItemsFromMarkdown,
} from "./open-issues.ts";
import type { RequirementDocument } from "./types.ts";

function createDocument(
  sections: RequirementDocument["sections"]
): RequirementDocument {
  return {
    id: "doc-1",
    meetingId: "meet-1",
    title: "要件定義書",
    markdown: "# 要件定義書\n",
    sections,
    createdAt: "2026-09-19T00:00:00.000Z",
    model: "preview",
    sourceUtteranceCount: 1,
    sourceDetectionCount: 1,
  };
}

describe("open issues helpers", () => {
  it("finds the open_issues section and treats placeholder text as empty", () => {
    const section = findOpenIssuesSection(
      createDocument([
        {
          sectionId: "open_issues",
          heading: "6. 未決事項（ToDo / 宿題）・確認中リスク一覧",
          bodyMarkdown: "（会議中に明示されず、要確認）",
        },
      ])
    );

    assert.ok(section);
    assert.equal(hasConcreteOpenIssues(section), false);
  });

  it("detects concrete ToDo items in the open issues section", () => {
    const section = findOpenIssuesSection(
      createDocument([
        {
          sectionId: "open_issues",
          heading: "6. 未決事項（ToDo / 宿題）・確認中リスク一覧",
          bodyMarkdown: "- リアルタイム同期の対象データを確認する",
        },
      ])
    );

    assert.equal(hasConcreteOpenIssues(section), true);
    assert.deepEqual(listOpenIssueItems(section), [
      "リアルタイム同期の対象データを確認する",
    ]);
    assert.equal(
      isOpenIssuesHeading("6. 未決事項（ToDo / 宿題）・確認中リスク一覧"),
      true
    );
  });

  it("reads open issue items from the current markdown body", () => {
    const markdown = `# まとめ

## 6. 未決事項（ToDo / 宿題）・確認中リスク一覧

- 直した確認事項
- もう一件

## 7. 発話ログ要約・変更履歴

- これは未決ではない
`;

    assert.deepEqual(listOpenIssueItemsFromMarkdown(markdown), [
      "直した確認事項",
      "もう一件",
    ]);
    assert.deepEqual(
      listOpenIssueItemsFromMarkdown("# まとめ\n\n本文だけです。"),
      []
    );
  });

  it("keeps todos after a lower-level heading inside the open issues section", () => {
    const markdown = `# まとめ

## 6. 未決事項（ToDo / 宿題）・確認中リスク一覧

- 先に確認すること

### リスク

- H3のあとの確認事項

## 7. 発話ログ要約・変更履歴

- これは未決ではない
`;

    assert.deepEqual(listOpenIssueItemsFromMarkdown(markdown), [
      "先に確認すること",
      "H3のあとの確認事項",
    ]);
  });
});
