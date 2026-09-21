"""Meeting dialogue context buffer and management."""

from dataclasses import dataclass, field

from app.domain.models.transcript import Utterance


@dataclass
class FlaggedAdviceTheme:
    """A lightweight record of a previously raised advice theme.

    Used only for duplicate suppression across repeated analysis calls
    within the same meeting session; not the full advice payload.
    """

    category: str
    title: str


@dataclass
class MeetingDialogueContext:
    """Manages the dialogue context for a single meeting session.

    Keeps the full history of utterances and provides sliding window views
    for real-time analysis. Also tracks previously flagged advice themes
    to suppress semantic duplicates across repeated analysis calls.
    """

    meeting_id: str
    utterances: list[Utterance] = field(default_factory=list)
    flagged_advice_themes: list[FlaggedAdviceTheme] = field(default_factory=list)

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

    def record_advice_themes(self, themes: list[FlaggedAdviceTheme]) -> None:
        """Append newly flagged advice themes to the session's history."""
        self.flagged_advice_themes.extend(themes)

    def get_previous_advice_themes(self, limit: int = 10) -> list[FlaggedAdviceTheme]:
        """Get the most recently flagged advice themes for duplicate suppression."""
        if limit <= 0:
            return []
        return self.flagged_advice_themes[-limit:]

    @property
    def total_utterances(self) -> int:
        return len(self.utterances)