"""Presentation schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


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


class AnalyzeDialogueRequest(BaseModel):
    """Request schema for REST dialogue analysis."""

    meeting_id: str = Field(..., description="Meeting identifier")
    utterances: list[str] = Field(
        default_factory=list,
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
        description=(
            "Category: 'ambiguity', 'contradiction', 'infeasibility', 'missing', "
            "'unexplained_jargon'"
        ),
    )
    priority: str = Field(default="medium", description="high / medium / low")
    title: str = Field(..., description="Concise issue title")
    reason: str = Field(default="", description="Why this is an issue")
    suggested_question: str = Field(
        default="",
        description="Follow-up question the PM should confirm",
    )
    quote: str | None = Field(default=None, description="Related utterance snippet")
    id: str | None = Field(default=None, description="Optional stable detection id")


class FinalizeMeetingRequest(BaseModel):
    """Optional seed payload when finalizing a meeting."""

    title: str | None = Field(default=None, description="Meeting / document title")
    utterances: list[str] = Field(
        default_factory=list,
        description="Optional transcript lines in format '[speaker] text'",
    )
    advice_items: list[FinalizeAdviceInput] = Field(
        default_factory=list,
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
