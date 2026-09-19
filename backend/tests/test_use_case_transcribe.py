"""Unit tests for TranscribeAudioUseCase."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases import TranscribeAudioUseCase
from app.domain.models.transcript import AudioChannel, AudioChunk, Speaker, Utterance


@pytest.mark.asyncio
async def test_transcribe_audio_use_case() -> None:
    mock_stt_service = AsyncMock()
    mock_stt_service.transcribe.return_value = [
        Utterance(
            id="utt-1",
            meeting_id="meeting-abc",
            speaker=Speaker.REMOTE_CLIENT,
            text="来週までに納品を希望しています。",
            start_ms=1000,
            end_ms=2500,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    ]

    use_case = TranscribeAudioUseCase(stt_service=mock_stt_service)
    chunk = AudioChunk(
        speaker=Speaker.REMOTE_CLIENT,
        channel=AudioChannel.RIGHT,
        data=b"fake-pcm",
        sample_rate=16000,
        timestamp_ms=1000,
    )

    result = await use_case.execute(audio_chunk=chunk, meeting_id="meeting-abc")

    assert len(result) == 1
    assert result[0].id == "utt-1"
    assert result[0].speaker == "remote_client"
    assert result[0].text == "来週までに納品を希望しています。"
    assert result[0].start_ms == 1000
    assert result[0].end_ms == 2500
