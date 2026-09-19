"""Domain entities."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class MeetingSession:
    """Represents a single meeting session."""

    id: str
    title: str
    created_at: datetime
