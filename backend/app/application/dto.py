"""Application DTOs."""

from dataclasses import dataclass
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
