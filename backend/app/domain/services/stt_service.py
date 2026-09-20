"""STT (Speech-to-Text) domain port interface."""

from typing import Protocol, runtime_checkable

from app.domain.models.transcript import Speaker, Utterance


@runtime_checkable
class STTSession(Protocol):
    """One live transcription stream for a single speaker."""

    async def append(self, audio_data: bytes, sample_rate: int) -> list[Utterance]:
        """Stream more PCM. Return newly available transcripts."""
        ...

    async def commit(self) -> list[Utterance]:
        """Finish the current turn. Keep the provider session open."""
        ...

    async def close(self) -> list[Utterance]:
        """Finish the current turn and release the provider session."""
        ...


@runtime_checkable
class STTService(Protocol):
    """Clean Architecture abstract domain port for STT."""

    def open_session(
        self,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> STTSession:
        """Open a live stream. Do not cut the provider connection between appends."""
        ...

    async def transcribe(
        self,
        audio_data: bytes,
        sample_rate: int,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> list[Utterance]:
        """Transcribe a finished audio buffer into one or more Utterances."""
        ...
