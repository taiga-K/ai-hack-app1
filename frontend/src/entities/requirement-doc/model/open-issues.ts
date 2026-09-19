import type { RequirementDocument, RequirementSection } from "./types";

const OPEN_ISSUES_SECTION_ID = "open_issues";
const OPEN_ISSUES_HEADING = "6. 未決事項（ToDo / 宿題）・確認中リスク一覧";
const EMPTY_OPEN_ISSUES_PLACEHOLDER = "（会議中に明示されず、要確認）";

export function findOpenIssuesSection(
  document: RequirementDocument
): RequirementSection | null {
  const byId = document.sections.find(
    (section) => section.sectionId === OPEN_ISSUES_SECTION_ID
  );
  if (byId) {
    return byId;
  }

  const byHeading = document.sections.find(
    (section) =>
      section.heading.includes("未決事項") ||
      section.heading === OPEN_ISSUES_HEADING
  );
  return byHeading ?? null;
}

export function hasConcreteOpenIssues(
  section: RequirementSection | null
): boolean {
  if (section === null) {
    return false;
  }

  const body = section.bodyMarkdown.trim();
  if (body.length === 0) {
    return false;
  }

  return body !== EMPTY_OPEN_ISSUES_PLACEHOLDER;
}

export function isOpenIssuesHeading(text: string): boolean {
  return text.includes("未決事項") || text === OPEN_ISSUES_HEADING;
}
