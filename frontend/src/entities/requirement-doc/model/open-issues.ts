import type { RequirementDocument, RequirementSection } from "./types";

const OPEN_ISSUES_SECTION_ID = "open_issues";
const OPEN_ISSUES_HEADING = "6. 未決事項（ToDo / 宿題）・確認中リスク一覧";
const EMPTY_OPEN_ISSUES_PLACEHOLDER = "（会議中に明示されず、要確認）";

export function isOpenIssuesHeading(text: string): boolean {
  return text.includes("未決事項") || text === OPEN_ISSUES_HEADING;
}

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

function parseMarkdownHeading(
  line: string
): { level: number; text: string } | null {
  const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());
  if (headingMatch === null) {
    return null;
  }
  return {
    level: headingMatch[1]?.length ?? 0,
    text: headingMatch[2]?.trim() ?? "",
  };
}

export function findOpenIssuesSectionFromMarkdown(
  markdown: string
): RequirementSection | null {
  const lines = markdown.split("\n");
  let heading = "";
  let headingLevel = 0;
  let bodyStart = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseMarkdownHeading(lines[index] ?? "");
    if (parsed === null) {
      continue;
    }
    if (isOpenIssuesHeading(parsed.text)) {
      heading = parsed.text;
      headingLevel = parsed.level;
      bodyStart = index + 1;
      break;
    }
  }

  if (bodyStart < 0) {
    return null;
  }

  const bodyLines: string[] = [];
  for (let index = bodyStart; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const parsed = parseMarkdownHeading(line);
    if (parsed !== null && parsed.level <= headingLevel) {
      break;
    }
    bodyLines.push(line);
  }

  return {
    sectionId: OPEN_ISSUES_SECTION_ID,
    heading,
    bodyMarkdown: bodyLines.join("\n").trim(),
  };
}

export function listOpenIssueItemsFromMarkdown(markdown: string): string[] {
  return listOpenIssueItems(findOpenIssuesSectionFromMarkdown(markdown));
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
