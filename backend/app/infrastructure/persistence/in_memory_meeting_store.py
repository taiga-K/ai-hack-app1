"""In-memory meeting session store (v1 session-scoped persistence)."""

from copy import deepcopy
from datetime import UTC, datetime
from threading import Condition
from time import monotonic

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
        self._live: dict[str, int] = {}
        self._closing: dict[str, int] = {}
        self._cond = Condition()

    def get(self, meeting_id: str) -> MeetingSessionRecord | None:
        with self._cond:
            record = self._records.get(meeting_id)
            if record is None:
                return None
            return deepcopy(record)

    def get_or_create(
        self,
        meeting_id: str,
        title: str | None = None,
    ) -> MeetingSessionRecord:
        with self._cond:
            record = self._ensure_locked(meeting_id, title)
            return deepcopy(record)

    def add_utterance(self, meeting_id: str, utterance: Utterance) -> None:
        with self._cond:
            record = self._ensure_locked(meeting_id, None)
            record.dialogue.add_utterance(utterance)

    def add_advice(self, meeting_id: str, item: AdviceItem) -> None:
        with self._cond:
            record = self._ensure_locked(meeting_id, None)
            record.add_advice(item)

    def update_title(self, meeting_id: str, title: str) -> None:
        with self._cond:
            record = self._ensure_locked(meeting_id, title)
            if title.strip():
                record.title = title.strip()

    def save_document(
        self,
        meeting_id: str,
        document: RequirementsDocument,
    ) -> MeetingSessionRecord:
        with self._cond:
            record = self._records.get(meeting_id)
            if record is None:
                raise MeetingNotFoundError(f"Meeting not found: {meeting_id}")
            record.document = document
            record.finalized_at = document.created_at
            if document.title.strip():
                record.title = document.title.strip()
            return deepcopy(record)

    def register_live_session(self, meeting_id: str) -> None:
        with self._cond:
            self._live[meeting_id] = self._live.get(meeting_id, 0) + 1
            self._cond.notify_all()

    def begin_close(self, meeting_id: str) -> None:
        with self._cond:
            live = self._live.get(meeting_id, 0)
            if live > 0:
                self._live[meeting_id] = live - 1
            self._closing[meeting_id] = self._closing.get(meeting_id, 0) + 1
            self._cond.notify_all()

    def end_close(self, meeting_id: str) -> None:
        with self._cond:
            closing = self._closing.get(meeting_id, 0)
            if closing > 0:
                self._closing[meeting_id] = closing - 1
            self._cond.notify_all()

    def wait_until_persist_settled(
        self,
        meeting_id: str,
        close_grace_seconds: float = 0.5,
        close_wait_seconds: float = 15.0,
    ) -> None:
        """Wait briefly for disconnect, then until leftover persist finishes."""
        grace_deadline = monotonic() + max(close_grace_seconds, 0.0)
        close_deadline = monotonic() + max(close_wait_seconds, 0.0)
        with self._cond:
            while True:
                live = self._live.get(meeting_id, 0)
                closing = self._closing.get(meeting_id, 0)
                now = monotonic()
                if closing == 0 and live == 0:
                    return
                if closing > 0:
                    remaining = close_deadline - now
                    if remaining <= 0:
                        return
                    self._cond.wait(timeout=remaining)
                    continue
                remaining = grace_deadline - now
                if remaining <= 0:
                    return
                self._cond.wait(timeout=remaining)

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
