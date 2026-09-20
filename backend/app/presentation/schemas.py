"""Presentation schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH = 128
MEETING_ID_PATH_PATTERN = r"^[A-Za-z0-9_-]{1,128}$"
ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS = 100
ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH = 2000
FINALIZE_TITLE_MAX_LENGTH = 200
FINALIZE_UTTERANCES_MAX_ITEMS = 500
FINALIZE_UTTERANCE_MAX_LENGTH = 2000
FINALIZE_ADVICE_MAX_ITEMS = 200
FINALIZE_ADVICE_TITLE_MAX_LENGTH = 500
FINALIZE_ADVICE_TEXT_MAX_LENGTH = 2000
FINALIZE_ADVICE_ID_MAX_LENGTH = 128


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str = Field(..., description="System status")
    version: str = Field(..., description="Application version")
    timestamp: datetime = Field(..., description="UTC timestamp of the check")


class UtteranceMessage(BaseModel):
    """Realtime transcribed utterance message sent to clients."""

    type: str = Field(default="utterance", description="Message type")
    id: str = Field(..., description="Unique utterance identifier")
    meeting_id: str = Field(..., description="Meeting identifier")
    speaker: str = Field(
        ...,
        description="Speaker identifier ('local_pm' or 'remote_client')",
    )
    text: str = Field(..., description="Transcribed text")
    start_ms: int = Field(..., description="Start timestamp in milliseconds")
    end_ms: int = Field(..., description="End timestamp in milliseconds")
    is_final: bool = Field(default=True, description="Whether utterance is final")
    created_at: datetime = Field(..., description="Timestamp of utterance creation")


class AdviceMessage(BaseModel):
    """Realtime advice message sent to clients upon ambiguity/contradiction detection."""

    type: str = Field(default="advice", description="Message type")
    id: str = Field(..., description="Unique advice identifier")
    meeting_id: str = Field(..., description="Meeting identifier")
    category: str = Field(
        ...,
        description=(
            "Category: 'ambiguity', 'contradiction', 'infeasibility', 'missing', "
            "'unexplained_jargon'"
        ),
    )
    priority: str = Field(
        ...,
        description="Urgency/priority: 'high', 'medium', 'low'",
    )
    title: str = Field(..., description="Concise summary title of the issue")
    reason: str = Field(
        ..., description="Explanation and risks associated with the issue"
    )
    suggested_question: str = Field(
        ...,
        description="Polite, concrete follow-up question for the PM to ask immediately",
    )
    detected_at: datetime = Field(..., description="Timestamp of detection")
    quote: str | None = Field(
        default=None,
        description="Quoted utterance snippet related to this advice",
    )


class MindMapNodeMessage(BaseModel):
    """One topic in a realtime mind-map event."""

    id: str
    label: str
    parent_id: str | None = None
    source_utterance_ids: list[str] = Field(default_factory=list)


class MindMapMessage(BaseModel):
    """Incremental mind-map update pushed to the meeting client."""

    type: str = Field(default="mindmap", description="Message type")
    meeting_id: str
    revision: int
    upserts: list[MindMapNodeMessage] = Field(default_factory=list)
    removes: list[str] = Field(default_factory=list)


class AnalyzeDialogueRequest(BaseModel):
    """Request schema for REST dialogue analysis."""

    meeting_id: str = Field(
        ...,
        max_length=ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH,
        description="Meeting identifier",
    )
    utterances: list[
        Annotated[str, Field(max_length=ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH)]
    ] = Field(
        default_factory=list,
        max_length=ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS,
        description="Optional list of transcript lines in format '[speaker] text'",
    )


class AdviceItemResponse(BaseModel):
    """Response schema for an advice item."""

    id: str
    category: str
    priority: str
    title: str
    reason: str
    suggested_question: str
    detected_at: datetime
    quote: str | None = None


class AnalyzeDialogueResponse(BaseModel):
    """Response schema for dialogue analysis."""

    meeting_id: str
    advice_items: list[AdviceItemResponse]
    analyzed_utterance_count: int


class FinalizeAdviceInput(BaseModel):
    """Optional detection seed for meeting finalize."""

    category: str = Field(
        ...,
        max_length=64,
        description=(
            "Category: 'ambiguity', 'contradiction', 'infeasibility', 'missing', "
            "'unexplained_jargon'"
        ),
    )
    priority: str = Field(
        default="medium",
        max_length=16,
        description="high / medium / low",
    )
    title: str = Field(
        ...,
        max_length=FINALIZE_ADVICE_TITLE_MAX_LENGTH,
        description="Concise issue title",
    )
    reason: str = Field(
        default="",
        max_length=FINALIZE_ADVICE_TEXT_MAX_LENGTH,
        description="Why this is an issue",
    )
    suggested_question: str = Field(
        default="",
        max_length=FINALIZE_ADVICE_TEXT_MAX_LENGTH,
        description="Follow-up question the PM should confirm",
    )
    quote: str | None = Field(
        default=None,
        max_length=FINALIZE_ADVICE_TEXT_MAX_LENGTH,
        description="Related utterance snippet",
    )
    id: str | None = Field(
        default=None,
        max_length=FINALIZE_ADVICE_ID_MAX_LENGTH,
        description="Optional stable detection id",
    )


class FinalizeMeetingRequest(BaseModel):
    """Optional seed payload when finalizing a meeting."""

    title: str | None = Field(
        default=None,
        max_length=FINALIZE_TITLE_MAX_LENGTH,
        description="Meeting / document title",
    )
    utterances: list[
        Annotated[str, Field(max_length=FINALIZE_UTTERANCE_MAX_LENGTH)]
    ] = Field(
        default_factory=list,
        max_length=FINALIZE_UTTERANCES_MAX_ITEMS,
        description="Optional transcript lines in format '[speaker] text'",
    )
    advice_items: list[FinalizeAdviceInput] = Field(
        default_factory=list,
        max_length=FINALIZE_ADVICE_MAX_ITEMS,
        description="Optional detections to include in generation context",
    )


class RequirementsSectionResponse(BaseModel):
    """One section of the generated requirements document."""

    section_id: str
    heading: str
    body_markdown: str


class RequirementsDocumentResponse(BaseModel):
    """Generated requirements document response."""

    id: str
    meeting_id: str
    title: str
    markdown: str
    sections: list[RequirementsSectionResponse]
    created_at: datetime
    model: str
    source_utterance_count: int
    source_detection_count: int
