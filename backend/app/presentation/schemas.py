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
