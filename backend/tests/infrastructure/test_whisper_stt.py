"""Unit tests for FasterWhisperSTTService."""

from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app.domain.models.transcript import Speaker
from app.infrastructure.stt.whisper_stt import FasterWhisperSTTService


@pytest.mark.asyncio
async def test_faster_whisper_transcribe_empty() -> None:
    service = FasterWhisperSTTService(lazy_load=True)
    utterances = await service.transcribe(
        audio_data=b"",
        sample_rate=16000,
        speaker=Speaker.LOCAL_PM,
        meeting_id="meeting-1",
    )
    assert utterances == []


@pytest.mark.asyncio
async def test_faster_whisper_transcribe_mocked() -> None:
    service = FasterWhisperSTTService(lazy_load=True)

    mock_segment = MagicMock()
    mock_segment.start = 0.5
    mock_segment.end = 2.0
    mock_segment.text = " こんにちは、要件を確認させてください。 "

    mock_model = MagicMock()
    mock_model.transcribe.return_value = ([mock_segment], MagicMock())

    with patch.object(service, "_get_model", return_value=mock_model):
        pcm = np.zeros(16000, dtype=np.int16).tobytes()
        utterances = await service.transcribe(
            audio_data=pcm,
            sample_rate=16000,
            speaker=Speaker.LOCAL_PM,
            meeting_id="meeting-123",
            start_offset_ms=1000,
        )

        assert len(utterances) == 1
        u = utterances[0]
        assert u.speaker == Speaker.LOCAL_PM
        assert u.meeting_id == "meeting-123"
        assert u.text == "こんにちは、要件を確認させてください。"
        assert u.start_ms == 1500  # 1000 + 500
        assert u.end_ms == 3000  # 1000 + 2000
        assert u.is_final is True


def test_faster_whisper_lazy_load_thread_safety() -> None:
    service = FasterWhisperSTTService(lazy_load=True)
    assert service._model is None

    mock_model_instance = MagicMock()
    with patch(
        "app.infrastructure.stt.whisper_stt.WhisperModel",
        return_value=mock_model_instance,
    ) as mock_cls:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(service._get_model) for _ in range(10)]
            models = [f.result() for f in futures]

        assert len(models) == 10
        assert all(m is mock_model_instance for m in models)
        mock_cls.assert_called_once()
