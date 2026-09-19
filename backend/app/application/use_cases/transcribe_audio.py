"""Speech-to-Text audio transcription use case."""

from app.application.dto import UtteranceDTO
from app.domain.models.transcript import AudioChunk
from app.domain.services.stt_service import STTService


class TranscribeAudioUseCase:
    """Use case to process mono audio chunk and transcribe speech."""

    def __init__(self, stt_service: STTService) -> None:
        self._stt_service = stt_service

    async def execute(
        self,
        audio_chunk: AudioChunk,
        meeting_id: str,
    ) -> list[UtteranceDTO]:
        """Transcribe an audio chunk and return utterance DTOs."""
        utterances = await self._stt_service.transcribe(
            audio_data=audio_chunk.data,
            sample_rate=audio_chunk.sample_rate,
            speaker=audio_chunk.speaker,
            meeting_id=meeting_id,
            start_offset_ms=audio_chunk.timestamp_ms,
        )

        return [
            UtteranceDTO(
                id=u.id,
                meeting_id=u.meeting_id,
                speaker=u.speaker.value,
                text=u.text,
                start_ms=u.start_ms,
                end_ms=u.end_ms,
                is_final=u.is_final,
                created_at=u.created_at,
            )
            for u in utterances
        ]
