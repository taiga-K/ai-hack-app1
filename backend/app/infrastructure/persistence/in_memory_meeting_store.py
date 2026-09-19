"""In-memory meeting session store (v1 session-scoped persistence)."""

from copy import deepcopy
from datetime import UTC, datetime
from threading import Lock

from app.domain.exceptions import MeetingNotFoundError
from app.domain.models.analysis import AdviceItem
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.meeting_session import MeetingSessionRecord
from app.domain.models.requirement_doc import RequirementsDocument
from app.domain.models.transcript import Utterance


class InMemoryMeetingSessionStore:
    """Process-local store for meeting transcripts, detections, and documents."""

    def __init__(self) -> None:
        self._records: dict[str, MeetingSessionRecord] = {}
        self._lock = Lock()

    def get(self, meeting_id: str) -> MeetingSessionRecord | None:
        with self._lock:
            record = self._records.get(meeting_id)
            if record is None:
                return None
            return deepcopy(record)

    def get_or_create(
        self,
        meeting_id: str,
        title: str | None = None,
    ) -> MeetingSessionRecord:
        with self._lock:
            record = self._ensure_locked(meeting_id, title)
            return deepcopy(record)

    def add_utterance(self, meeting_id: str, utterance: Utterance) -> None:
        with self._lock:
            record = self._ensure_locked(meeting_id, None)
            record.dialogue.add_utterance(utterance)

    def add_advice(self, meeting_id: str, item: AdviceItem) -> None:
        with self._lock:
            record = self._ensure_locked(meeting_id, None)
            record.add_advice(item)

    def update_title(self, meeting_id: str, title: str) -> None:
        with self._lock:
            record = self._ensure_locked(meeting_id, title)
            if title.strip():
                record.title = title.strip()

    def save_document(
        self,
        meeting_id: str,
        document: RequirementsDocument,
    ) -> MeetingSessionRecord:
        with self._lock:
            record = self._records.get(meeting_id)
            if record is None:
                raise MeetingNotFoundError(f"Meeting not found: {meeting_id}")
            record.document = document
            record.finalized_at = document.created_at
            if document.title.strip():
                record.title = document.title.strip()
            return deepcopy(record)

    def _ensure_locked(
        self,
        meeting_id: str,
        title: str | None,
    ) -> MeetingSessionRecord:
        record = self._records.get(meeting_id)
        if record is None:
            now = datetime.now(UTC)
            record = MeetingSessionRecord(
                meeting_id=meeting_id,
                title=(title or "").strip() or f"会議 {meeting_id}",
                created_at=now,
                dialogue=MeetingDialogueContext(meeting_id=meeting_id),
            )
            self._records[meeting_id] = record
            return record
        if title and title.strip():
            record.title = title.strip()
        return record
