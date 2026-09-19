"""Session-scoped persistence adapters."""

from app.infrastructure.persistence.in_memory_meeting_store import (
    InMemoryMeetingSessionStore,
)

__all__ = ["InMemoryMeetingSessionStore"]
