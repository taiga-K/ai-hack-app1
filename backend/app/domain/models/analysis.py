"""Analysis and real-time advice domain models."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class IssueCategory(StrEnum):
    """Category of detected conversation issue."""

    AMBIGUITY = "ambiguity"  # 曖昧な要件・条件
    CONTRADICTION = "contradiction"  # 前後の発言や前提との矛盾
    INFEASIBILITY = "infeasibility"  # 納期・工数・技術的な無理/高リスク
    MISSING_REQUIREMENT = "missing"  # 聞き忘れ・未確認事項


class AdvicePriority(StrEnum):
    """Priority level for generated advice."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class AdviceItem:
    """An actionable piece of advice with concrete follow-up question for PM."""

    id: str
    category: IssueCategory
    priority: AdvicePriority
    title: str
    reason: str
    suggested_question: str
    detected_at: datetime
    quote: str | None = None


@dataclass(frozen=True)
class AnalysisResult:
    """Result of analyzing dialogue context."""

    meeting_id: str
    advice_items: list[AdviceItem] = field(default_factory=list)
    analyzed_utterance_count: int = 0
