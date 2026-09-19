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
        """Append a transcribed utterance to the meeting session."""
        ...

    def add_advice(self, meeting_id: str, item: AdviceItem) -> None:
        """Append a detection/advice item, ignoring duplicates by id."""
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
