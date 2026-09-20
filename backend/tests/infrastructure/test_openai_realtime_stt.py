"""Unit tests for OpenAI Realtime Whisper STT, with the network boundary mocked."""

from datetime import UTC

import pytest

from app.application.use_cases import TranscribeAudioUseCase
from app.domain.exceptions import STTConfigurationError, STTServiceError
from app.domain.models.transcript import AudioChannel, AudioChunk, Speaker
from app.infrastructure.config import Settings
from app.infrastructure.stt.factory import build_stt_service
from app.infrastructure.stt.openai_realtime import (
    OpenAIRealtimeWhisperSTTService,
    _wait_for_completed_transcript,
    parse_realtime_event,
    transcript_from_completed_event,
)
from app.infrastructure.stt.pcm import OPENAI_REALTIME_PCM_RATE, resample_pcm16_le


class _FakeTransport:
    def __init__(self, text: str = "要件を確認させてください。") -> None:
        self.text = text
        self.calls: list[tuple[bytes, int, str, str]] = []

    async def transcribe_committed_pcm(
        self,
        pcm16_le: bytes,
        sample_rate: int,
        language: str,
        model: str,
    ) -> str:
        self.calls.append((pcm16_le, sample_rate, language, model))
        return self.text


@pytest.mark.asyncio
async def test_transcribe_empty_audio_returns_no_utterances() -> None:
    service = OpenAIRealtimeWhisperSTTService(
        api_key="sk-test",
        transport=_FakeTransport(),
    )
    utterances = await service.transcribe(
        audio_data=b"",
        sample_rate=16000,
        speaker=Speaker.LOCAL_PM,
        meeting_id="meeting-1",
    )
    assert utterances == []


@pytest.mark.asyncio
async def test_transcribe_maps_completed_text_onto_utterance() -> None:
    transport = _FakeTransport("  こんにちは、要件を確認させてください。 ")
    service = OpenAIRealtimeWhisperSTTService(
        api_key="sk-test",
        model="gpt-realtime-whisper",
        language="ja",
        transport=transport,
    )
    pcm = b"\x00\x10" * 16000
    utterances = await service.transcribe(
        audio_data=pcm,
        sample_rate=16000,
        speaker=Speaker.LOCAL_PM,
        meeting_id="meeting-123",
        start_offset_ms=1000,
    )

    assert len(utterances) == 1
    utterance = utterances[0]
    assert utterance.speaker == Speaker.LOCAL_PM
    assert utterance.meeting_id == "meeting-123"
    assert utterance.text == "こんにちは、要件を確認させてください。"
    assert utterance.start_ms == 1000
    assert utterance.end_ms == 2000
    assert utterance.is_final is True
    assert utterance.created_at.tzinfo is UTC
    assert transport.calls == [(pcm, 16000, "ja", "gpt-realtime-whisper")]


@pytest.mark.asyncio
async def test_transcribe_blank_model_text_returns_no_utterances() -> None:
    service = OpenAIRealtimeWhisperSTTService(
        api_key="sk-test",
        transport=_FakeTransport("   "),
    )
    utterances = await service.transcribe(
        audio_data=b"\x00\x00\x01\x00",
        sample_rate=16000,
        speaker=Speaker.REMOTE_CLIENT,
        meeting_id="meeting-1",
    )
    assert utterances == []


@pytest.mark.asyncio
async def test_missing_openai_key_fails_closed_on_transcribe() -> None:
    service = OpenAIRealtimeWhisperSTTService(api_key="")
    with pytest.raises(STTConfigurationError, match="OPENAI_API_KEY"):
        await service.transcribe(
            audio_data=b"\x00\x00\x01\x00",
            sample_rate=16000,
            speaker=Speaker.LOCAL_PM,
            meeting_id="meeting-1",
        )


def test_build_stt_service_openai() -> None:
    settings = Settings(stt_provider="openai", openai_api_key="sk-test")
    service = build_stt_service(settings)
    assert isinstance(service, OpenAIRealtimeWhisperSTTService)


def test_build_stt_service_rejects_ws_stt_url() -> None:
    settings = Settings(
        stt_provider="openai",
        openai_api_key="sk-test",
        openai_stt_url="ws://api.openai.com/v1/realtime",
    )
    with pytest.raises(STTConfigurationError, match="wss://"):
        build_stt_service(settings)
    with pytest.raises(STTConfigurationError, match="wss://"):
        settings.openai_stt_wss_url()


def test_settings_rejects_non_wss_stt_url() -> None:
    settings = Settings(openai_stt_url="https://api.openai.com/v1/realtime")
    with pytest.raises(STTConfigurationError, match="wss://"):
        settings.openai_stt_wss_url()


def test_build_stt_service_azure_fails_closed() -> None:
    settings = Settings(stt_provider="azure", openai_api_key="sk-test")
    with pytest.raises(STTConfigurationError, match="STT_PROVIDER=azure"):
        build_stt_service(settings)


def test_build_stt_service_unknown_fails_closed() -> None:
    settings = Settings(stt_provider="deepgram", openai_api_key="sk-test")
    with pytest.raises(STTConfigurationError, match="Unknown STT_PROVIDER"):
        build_stt_service(settings)


@pytest.mark.asyncio
async def test_wait_for_completed_transcript_skips_deltas() -> None:
    events = [
        '{"type":"session.updated"}',
        '{"type":"conversation.item.input_audio_transcription.delta","delta":"は"}',
        '{"type":"conversation.item.input_audio_transcription.completed","transcript":"はい"}',
    ]

    async def receive() -> str:
        return events.pop(0)

    text = await _wait_for_completed_transcript(receive, 1.0)
    assert text == "はい"


def test_parse_completed_event_and_error_event() -> None:
    completed = parse_realtime_event(
        '{"type":"conversation.item.input_audio_transcription.completed","transcript":"  了解です。 "}'
    )
    assert transcript_from_completed_event(completed) == "了解です。"
    assert (
        transcript_from_completed_event(
            parse_realtime_event(
                '{"type":"conversation.item.input_audio_transcription.delta","delta":"了"}'
            )
        )
        is None
    )
    with pytest.raises(STTServiceError, match="quota"):
        transcript_from_completed_event(
            parse_realtime_event(
                '{"type":"error","error":{"message":"quota exceeded"}}'
            )
        )


def test_resample_pcm16_16k_to_24k_length() -> None:
    pcm_16k = b"\x00\x10" * 160
    pcm_24k = resample_pcm16_le(pcm_16k, 16000, OPENAI_REALTIME_PCM_RATE)
    assert len(pcm_24k) == 240 * 2
    assert resample_pcm16_le(pcm_16k, 16000, 16000) == pcm_16k


@pytest.mark.asyncio
async def test_use_case_still_depends_only_on_stt_port() -> None:
    service = OpenAIRealtimeWhisperSTTService(
        api_key="sk-test",
        transport=_FakeTransport("来週までに納品を希望しています。"),
    )
    use_case = TranscribeAudioUseCase(stt_service=service)
    result = await use_case.execute(
        audio_chunk=AudioChunk(
            speaker=Speaker.REMOTE_CLIENT,
            channel=AudioChannel.RIGHT,
            data=b"\x00\x00" * 8000,
            sample_rate=16000,
            timestamp_ms=1000,
        ),
        meeting_id="meeting-abc",
    )

    assert len(result) == 1
    assert result[0].speaker == "remote_client"
    assert result[0].text == "来週までに納品を希望しています。"
    assert result[0].start_ms == 1000
    assert result[0].end_ms == 1500
    assert result[0].created_at is not None
