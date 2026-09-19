"""Meeting session repository port."""

from typing import Protocol, runtime_checkable

from app.domain.models.analysis import AdviceItem
from app.domain.models.meeting_session import MeetingSessionRecord
from app.domain.models.requirement_doc import RequirementsDocument
from app.domain.models.transcript import Utterance


@runtime_checkable
class MeetingSessionRepository(Protocol):
    """Abstract persistence for meeting transcripts, detections, and documents."""

    def get(self, meeting_id: str) -> MeetingSessionRecord | None:
        """Return a snapshot of the meeting session, or None if absent."""
        ...

    def get_or_create(
        self,
        meeting_id: str,
        title: str | None = None,
    ) -> MeetingSessionRecord:
        """Return an existing session or create an empty one."""
        ...

    def add_utterance(self, meeting_id: str, utterance: Utterance) -> None:
        """Append a transcribed utterance, ignoring duplicates by id."""
        ...

    def add_advice(self, meeting_id: str, item: AdviceItem) -> None:
        """Append a detection/advice item, ignoring duplicates by id."""
        ...

    def register_live_session(self, meeting_id: str) -> None:
        """Mark a live audio WebSocket session for the meeting."""
        ...

    def begin_close(self, meeting_id: str) -> None:
        """Mark that disconnect flush/persist has started."""
        ...

    def end_close(self, meeting_id: str) -> None:
        """Mark that disconnect flush/persist has finished."""
        ...

    def wait_until_persist_settled(
        self,
        meeting_id: str,
        close_grace_seconds: float = 0.5,
        close_wait_seconds: float = 15.0,
    ) -> None:
        """Wait for an in-flight disconnect persist before snapshotting."""
        ...

    def update_title(self, meeting_id: str, title: str) -> None:
        """Update the display title of a meeting session."""
        ...

    def save_document(
        self,
        meeting_id: str,
        document: RequirementsDocument,
    ) -> MeetingSessionRecord:
        """Persist a generated requirements document onto the session."""
        ...
