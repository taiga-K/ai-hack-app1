"""Meeting dialogue context buffer and management."""

from dataclasses import dataclass, field

from app.domain.models.transcript import Utterance


@dataclass
class MeetingDialogueContext:
    """Manages the dialogue context for a single meeting session.

    Keeps the full history of utterances and provides sliding window views
    for real-time analysis.
    """

    meeting_id: str
    utterances: list[Utterance] = field(default_factory=list)

    def add_utterance(self, utterance: Utterance) -> bool:
        """Add a transcribed utterance, ignoring duplicates by id."""
        if any(existing.id == utterance.id for existing in self.utterances):
            return False
        self.utterances.append(utterance)
        return True

    def get_recent_utterances(self, limit: int = 10) -> list[Utterance]:
        """Get the most recent N utterances."""
        if limit <= 0:
            return []
        return self.utterances[-limit:]

    def get_formatted_transcript(self, limit: int | None = None) -> str:
        """Format utterances into a readable transcript for prompt evaluation."""
        target_utterances = (
            self.utterances if limit is None else self.utterances[-limit:]
        )
        lines: list[str] = []
        for u in target_utterances:
            speaker_label = (
                "自社PM" if u.speaker.value == "local_pm" else "相手クライアント"
            )
            lines.append(f"[{speaker_label}] {u.text}")
        return "\n".join(lines)

    @property
    def total_utterances(self) -> int:
        return len(self.utterances)
