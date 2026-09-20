"""STT (Speech-to-Text) domain port interface."""

from typing import Protocol, runtime_checkable

from app.domain.models.transcript import Speaker, Utterance


@runtime_checkable
class STTService(Protocol):
    """Clean Architecture abstract domain port for STT."""

    async def transcribe(
        self,
        audio_data: bytes,
        sample_rate: int,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> list[Utterance]:
        """Transcribe an audio chunk into one or more Utterances."""
        ...
