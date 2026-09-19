"""Requirements document domain model and Markdown assembly."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class RequirementsSectionId(StrEnum):
    """Canonical section identifiers for a structured requirements document."""

    OVERVIEW = "overview"
    SCOPE = "scope"
    BUSINESS_FLOW = "business_flow"
    FUNCTIONAL = "functional"
    NON_FUNCTIONAL = "non_functional"
    OPEN_ISSUES = "open_issues"
    CHANGELOG = "changelog"


REQUIRED_SECTION_HEADINGS: tuple[tuple[RequirementsSectionId, str], ...] = (
    (RequirementsSectionId.OVERVIEW, "1. プロジェクト/会議概要・背景・ゴール"),
    (RequirementsSectionId.SCOPE, "2. スコープ（対象範囲・対象外範囲）"),
    (RequirementsSectionId.BUSINESS_FLOW, "3. 業務フロー・ユースケース定義"),
    (RequirementsSectionId.FUNCTIONAL, "4. 機能要件一覧（優先度・概要・受け入れ基準）"),
    (RequirementsSectionId.NON_FUNCTIONAL, "5. 非機能要件・制約条件"),
    (RequirementsSectionId.OPEN_ISSUES, "6. 未決事項（ToDo / 宿題）・確認中リスク一覧"),
    (RequirementsSectionId.CHANGELOG, "7. 発話ログ要約・変更履歴"),
)

EMPTY_SECTION_PLACEHOLDER = "（会議中に明示されず、要確認）"

UNTRUSTED_TRANSCRIPT_START = "<<<UNTRUSTED_TRANSCRIPT_START>>>"
UNTRUSTED_TRANSCRIPT_END = "<<<UNTRUSTED_TRANSCRIPT_END>>>"


@dataclass(frozen=True)
class RequirementsSection:
    """A single section of the structured requirements document."""

    section_id: RequirementsSectionId
    heading: str
    body_markdown: str
    level: int = 2


@dataclass(frozen=True)
class RequirementsDocument:
    """Generated requirements document entity stored for a meeting session."""

    id: str
    meeting_id: str
    title: str
    markdown: str
    sections: tuple[RequirementsSection, ...]
    created_at: datetime
    model: str
    source_utterance_count: int
    source_detection_count: int


def sanitize_untrusted_transcript_text(text: str) -> str:
    """Neutralize delimiter / role-marker lookalikes inside untrusted logs."""
    replacements = (
        (UNTRUSTED_TRANSCRIPT_START, "[[UNTRUSTED_TRANSCRIPT_START]]"),
        (UNTRUSTED_TRANSCRIPT_END, "[[UNTRUSTED_TRANSCRIPT_END]]"),
        ("```", "'''"),
    )
    sanitized = text
    for source, target in replacements:
        sanitized = sanitized.replace(source, target)
    return sanitized


def normalize_section_body_headings(body: str) -> str:
    """Demote in-section headings so the document keeps a single H1 and fixed H2s."""
    if not body.strip():
        return EMPTY_SECTION_PLACEHOLDER

    normalized_lines: list[str] = []
    for line in body.splitlines():
        stripped = line.lstrip()
        if not stripped.startswith("#"):
            normalized_lines.append(line)
            continue

        hash_count = len(stripped) - len(stripped.lstrip("#"))
        rest = stripped[hash_count:].lstrip()
        level = min(max(hash_count, 3), 6)
        normalized_lines.append(f"{'#' * level} {rest}")

    normalized = "\n".join(normalized_lines).strip()
    return normalized or EMPTY_SECTION_PLACEHOLDER


def assemble_requirements_sections(
    section_bodies: dict[RequirementsSectionId, str],
) -> tuple[RequirementsSection, ...]:
    """Build the canonical 7 sections, filling missing bodies with a placeholder."""
    sections: list[RequirementsSection] = []
    for section_id, heading in REQUIRED_SECTION_HEADINGS:
        raw_body = section_bodies.get(section_id, "")
        sections.append(
            RequirementsSection(
                section_id=section_id,
                heading=heading,
                body_markdown=normalize_section_body_headings(raw_body),
                level=2,
            )
        )
    return tuple(sections)


def assemble_requirements_markdown(
    title: str,
    sections: tuple[RequirementsSection, ...],
) -> str:
    """Assemble a validated Markdown document with the required heading structure."""
    document_title = title.strip() or "要件定義書"
    lines: list[str] = [f"# {document_title}", ""]
    for section in sections:
        lines.append(f"## {section.heading}")
        lines.append("")
        lines.append(section.body_markdown)
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def validate_requirements_markdown(markdown: str) -> bool:
    """Return True when the Markdown contains the required H1 and seven H2 headings."""
    if not markdown.lstrip().startswith("# "):
        return False
    for _, heading in REQUIRED_SECTION_HEADINGS:
        if f"## {heading}" not in markdown:
            return False
    return True
