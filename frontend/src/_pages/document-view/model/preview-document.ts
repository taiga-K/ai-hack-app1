import type { RequirementDocument } from "@/entities/requirement-doc";

export function createPreviewRequirementDocument(
  meetingId: string,
  title: string
): RequirementDocument {
  const markdown = `# ${title}

## 1. プロジェクト/会議概要・背景・ゴール

既存顧客向けの更新申請を、来月末までに本番投入することを目指すヒアリングです。相手は API 連携によるリアルタイム同期を希望しています。

## 2. スコープ（対象範囲・対象外範囲）

- 対象: 既存顧客向けの更新申請
- 対象外: 新規顧客の申請、一括更新（未確認）

## 3. 業務フロー・ユースケース定義

1. 顧客が更新申請を行う
2. システムが申請内容を取り込む
3. 自社側で確認し、既存データへ反映する

## 4. 機能要件一覧（優先度・概要・受け入れ基準）

| 優先度 | 概要 | 受け入れ基準 |
| :--- | :--- | :--- |
| 高 | 更新申請の取り込み | 既存顧客の申請が画面から確認できる |
| 未確認 | API連携によるリアルタイム同期 | 対象データと双方向の要否が未決 |

## 5. 非機能要件・制約条件

- 希望納期: 来月末本番投入
- 連携方式: API（範囲未定義）

## 6. 未決事項（ToDo / 宿題）・確認中リスク一覧

- 『API連携でリアルタイム同期』の対象データと、参照のみか書き込みまで含むかを確認する
- 新規顧客の申請や一括更新が今回の対象外か確認する
- 来月末本番は参照のみの暫定連携でも成立するか確認する

## 7. 発話ログ要約・変更履歴

- 自社PM: 対象範囲は既存顧客向けの更新申請だけか確認
- 相手: はい。API連携でリアルタイムに同期できれば来月末までに本番投入したい
- 相手: 了解です。そこはお任せします
`;

  return {
    id: `preview-doc-${meetingId}`,
    meetingId,
    title,
    markdown,
    sections: [
      {
        sectionId: "overview",
        heading: "1. プロジェクト/会議概要・背景・ゴール",
        bodyMarkdown:
          "既存顧客向けの更新申請を、来月末までに本番投入することを目指すヒアリングです。",
      },
      {
        sectionId: "scope",
        heading: "2. スコープ（対象範囲・対象外範囲）",
        bodyMarkdown: "- 対象: 既存顧客向けの更新申請",
      },
      {
        sectionId: "business_flow",
        heading: "3. 業務フロー・ユースケース定義",
        bodyMarkdown: "1. 顧客が更新申請を行う",
      },
      {
        sectionId: "functional",
        heading: "4. 機能要件一覧（優先度・概要・受け入れ基準）",
        bodyMarkdown: "更新申請の取り込みと、未確認のリアルタイム同期。",
      },
      {
        sectionId: "non_functional",
        heading: "5. 非機能要件・制約条件",
        bodyMarkdown: "希望納期は来月末。連携方式は未定義。",
      },
      {
        sectionId: "open_issues",
        heading: "6. 未決事項（ToDo / 宿題）・確認中リスク一覧",
        bodyMarkdown:
          "- 『API連携でリアルタイム同期』の対象データと、参照のみか書き込みまで含むかを確認する\n- 新規顧客の申請や一括更新が今回の対象外か確認する\n- 来月末本番は参照のみの暫定連携でも成立するか確認する",
      },
      {
        sectionId: "changelog",
        heading: "7. 発話ログ要約・変更履歴",
        bodyMarkdown: "プレビュー用の発話要約です。",
      },
    ],
    createdAt: "2026-09-19T00:00:00.000Z",
    model: "preview",
    sourceUtteranceCount: 4,
    sourceDetectionCount: 3,
  };
}
