"""Speech-to-Text audio transcription use case."""

from datetime import datetime

from app.application.dto import UtteranceDTO
from app.domain.models.transcript import AudioChunk, Speaker, Utterance
from app.domain.services.stt_service import STTService, STTSession


class TranscriptStream:
    """Application wrapper around one speaker's live STT session."""

    def __init__(self, session: STTSession) -> None:
        self._session = session

    async def append(self, audio_chunk: AudioChunk) -> list[UtteranceDTO]:
        """Stream one mono chunk and return any new transcripts."""
        utterances = await self._session.append(
            audio_chunk.data,
            audio_chunk.sample_rate,
        )
        return [_to_dto(utterance) for utterance in utterances]

    async def commit(self, *, wait: bool = False) -> list[UtteranceDTO]:
        """Finish the current turn without closing the provider session."""
        return [
            _to_dto(utterance) for utterance in await self._session.commit(wait=wait)
        ]

    async def close(self) -> list[UtteranceDTO]:
        """Commit the open turn and close the provider session."""
        return [_to_dto(utterance) for utterance in await self._session.close()]


class TranscribeAudioUseCase:
    """Use case to process mono audio and transcribe speech."""

    def __init__(self, stt_service: STTService) -> None:
        self._stt_service = stt_service

    def open_stream(
        self,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> TranscriptStream:
        """Start a live stream that stays open across appends."""
        return TranscriptStream(
            self._stt_service.open_session(
                speaker=speaker,
                meeting_id=meeting_id,
                start_offset_ms=start_offset_ms,
            )
        )

    async def execute(
        self,
        audio_chunk: AudioChunk,
        meeting_id: str,
    ) -> list[UtteranceDTO]:
        """Transcribe a finished audio chunk and return utterance DTOs."""
        utterances = await self._stt_service.transcribe(
            audio_data=audio_chunk.data,
            sample_rate=audio_chunk.sample_rate,
            speaker=audio_chunk.speaker,
            meeting_id=meeting_id,
            start_offset_ms=audio_chunk.timestamp_ms,
        )
        return [_to_dto(utterance) for utterance in utterances]


def _to_dto(utterance: Utterance) -> UtteranceDTO:
    created_at: datetime = utterance.created_at
    return UtteranceDTO(
        id=utterance.id,
        meeting_id=utterance.meeting_id,
        speaker=utterance.speaker.value,
        text=utterance.text,
        start_ms=utterance.start_ms,
        end_ms=utterance.end_ms,
        is_final=utterance.is_final,
        created_at=created_at,
    )
