"""Application DTOs."""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class HealthStatusDTO:
    """DTO for system health status."""

    status: str
    version: str
    timestamp: datetime


@dataclass(frozen=True)
class UtteranceDTO:
    """DTO for a transcribed utterance."""

    id: str
    meeting_id: str
    speaker: str
    text: str
    start_ms: int
    end_ms: int
    is_final: bool
    created_at: datetime


@dataclass(frozen=True)
class AdviceItemDTO:
    """DTO for an individual detected advice item."""

    id: str
    category: str
    priority: str
    title: str
    reason: str
    suggested_question: str
    detected_at: datetime
    quote: str | None = None


@dataclass(frozen=True)
class AnalysisResultDTO:
    """DTO for analysis result containing detected advice items."""

    meeting_id: str
    advice_items: list[AdviceItemDTO] = field(default_factory=list)
    analyzed_utterance_count: int = 0
