"""Unit tests for TranscribeAudioUseCase."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

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


@pytest.mark.asyncio
async def test_open_stream_appends_through_session() -> None:
    mock_session = AsyncMock()
    mock_session.append.return_value = []
    mock_session.close.return_value = [
        Utterance(
            id="utt-stream",
            meeting_id="meeting-abc",
            speaker=Speaker.LOCAL_PM,
            text="接続は切らずに流します。",
            start_ms=0,
            end_ms=1200,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    ]
    mock_stt_service = MagicMock()
    mock_stt_service.open_session.return_value = mock_session
    use_case = TranscribeAudioUseCase(stt_service=mock_stt_service)
    stream = use_case.open_stream(Speaker.LOCAL_PM, "meeting-abc")
    chunk = AudioChunk(
        speaker=Speaker.LOCAL_PM,
        channel=AudioChannel.LEFT,
        data=b"\x00\x10\x00\x10",
        sample_rate=16000,
        timestamp_ms=0,
    )
    assert await stream.append(chunk) == []
    result = await stream.close()
    assert result[0].text == "接続は切らずに流します。"
    mock_stt_service.open_session.assert_called_once()
    mock_session.append.assert_awaited_once()
    mock_session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_open_stream_commit_keeps_session() -> None:
    mock_session = AsyncMock()
    mock_session.commit.return_value = [
        Utterance(
            id="utt-turn",
            meeting_id="meeting-abc",
            speaker=Speaker.LOCAL_PM,
            text="こちらのターンです。",
            start_ms=0,
            end_ms=800,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    ]
    mock_stt_service = MagicMock()
    mock_stt_service.open_session.return_value = mock_session
    stream = TranscribeAudioUseCase(stt_service=mock_stt_service).open_stream(
        Speaker.LOCAL_PM,
        "meeting-abc",
    )
    result = await stream.commit()
    assert result[0].id == "utt-turn"
    mock_session.commit.assert_awaited_once()
    mock_session.close.assert_not_awaited()
