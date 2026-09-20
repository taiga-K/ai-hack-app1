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


@dataclass(frozen=True)
class MindMapRelationDTO:
    """DTO for one directed relation between meeting-map nodes."""

    kind: str
    target_id: str


@dataclass(frozen=True)
class MindMapNodeDTO:
    """DTO for one meeting-map claim."""

    id: str
    label: str
    parent_id: str | None
    kind: str = "topic"
    status: str = "open"
    detail: str = ""
    relations: list[MindMapRelationDTO] = field(default_factory=list)
    history: list[str] = field(default_factory=list)
    pinned: bool = False
    source_utterance_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class MindMapPendingDTO:
    """DTO for a held fragment carried to the next analysis window."""

    text: str
    source_utterance_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class MindMapUpdateDTO:
    """DTO for an incremental meeting-map update.

    ``analyzed`` is False when the window could not be analyzed (LLM or parse
    failure); the caller must keep that window for a later pass.
    """

    meeting_id: str
    revision: int
    upserts: list[MindMapNodeDTO] = field(default_factory=list)
    pending: list[MindMapPendingDTO] = field(default_factory=list)
    nodes: list[MindMapNodeDTO] = field(default_factory=list)
    source_utterance_count: int = 0
    changed: bool = False
    analyzed: bool = True


@dataclass(frozen=True)
class RequirementsSectionDTO:
    """DTO for one requirements document section."""

    section_id: str
    heading: str
    body_markdown: str


@dataclass(frozen=True)
class RequirementsDocumentDTO:
    """DTO for a generated requirements document."""

    id: str
    meeting_id: str
    title: str
    markdown: str
    sections: list[RequirementsSectionDTO]
    created_at: datetime
    model: str
    source_utterance_count: int
    source_detection_count: int
