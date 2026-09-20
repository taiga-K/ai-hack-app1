"""Meeting session aggregate for transcripts, detections, and generated docs."""

from dataclasses import dataclass, field
from datetime import datetime

from app.domain.models.analysis import AdviceItem
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.mind_map import MindMapSnapshot
from app.domain.models.requirement_doc import RequirementsDocument


@dataclass
class MeetingSessionRecord:
    """In-session state for one meeting (v1: process-local persistence)."""

    meeting_id: str
    title: str
    created_at: datetime
    dialogue: MeetingDialogueContext
    advice_items: list[AdviceItem] = field(default_factory=list)
    document: RequirementsDocument | None = None
    finalized_at: datetime | None = None
    mind_map: MindMapSnapshot | None = None

    def add_advice(self, item: AdviceItem) -> bool:
        """Append an advice item if its id has not been recorded yet."""
        if any(existing.id == item.id for existing in self.advice_items):
            return False
        self.advice_items.append(item)
        return True
