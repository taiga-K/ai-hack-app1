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

export function listOpenIssueItems(
  section: RequirementSection | null
): string[] {
  if (section === null) {
    return [];
  }

  const body = section.bodyMarkdown.trim();
  if (body.length === 0 || body === EMPTY_OPEN_ISSUES_PLACEHOLDER) {
    return [];
  }

  const bullets = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);

  if (bullets.length > 0) {
    return bullets;
  }

  return [body];
}

export function hasConcreteOpenIssues(
  section: RequirementSection | null
): boolean {
  return listOpenIssueItems(section).length > 0;
}

export function isOpenIssuesHeading(text: string): boolean {
  return text.includes("未決事項") || text === OPEN_ISSUES_HEADING;
}
