export const REQUIREMENT_SECTION_IDS = [
  "overview",
  "scope",
  "business_flow",
  "functional",
  "non_functional",
  "open_issues",
  "changelog",
] as const;

export type RequirementSectionId = (typeof REQUIREMENT_SECTION_IDS)[number];

export const OPEN_ISSUES_SECTION_ID = "open_issues";

export const OPEN_ISSUES_HEADING =
  "6. 未決事項（ToDo / 宿題）・確認中リスク一覧";

export interface RequirementSection {
  sectionId: string;
  heading: string;
  bodyMarkdown: string;
}

export interface RequirementDocument {
  id: string;
  meetingId: string;
  title: string;
  markdown: string;
  sections: RequirementSection[];
  createdAt: string;
  model: string;
  sourceUtteranceCount: number;
  sourceDetectionCount: number;
}

export interface FinalizeAdviceInput {
  category: string;
  priority: string;
  title: string;
  reason: string;
  suggestedQuestion: string;
  quote: string | null;
  id?: string;
}

export interface FinalizeRequirementDocumentInput {
  title?: string;
  utterances: string[];
  adviceItems: FinalizeAdviceInput[];
}
