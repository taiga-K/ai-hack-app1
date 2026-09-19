"""faster-whisper and Silero VAD based Speech-to-Text adapter."""

import asyncio
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

import numpy as np
from faster_whisper import WhisperModel

from app.domain.exceptions import STTServiceError
from app.domain.models.transcript import Speaker, Utterance
from app.domain.services.stt_service import STTService


class FasterWhisperSTTService(STTService):
    """faster-whisper and Silero VAD implementation of STTService."""

    def __init__(
        self,
        model_size: str = "base",
        device: str = "cpu",
        compute_type: str = "int8",
        language: str = "ja",
        initial_prompt: str | None = "こんにちは。本日の会議を始めます。",
        executor: ThreadPoolExecutor | None = None,
        lazy_load: bool = True,
    ) -> None:
        self._model_size = model_size
        self._device = device
        self._compute_type = compute_type
        self._language = language
        self._initial_prompt = initial_prompt
        self._executor = executor
        self._model: WhisperModel | None = None
        self._model_lock = threading.Lock()
        if not lazy_load:
            self._get_model()

    def _get_model(self) -> WhisperModel:
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    try:
                        self._model = WhisperModel(
                            self._model_size,
                            device=self._device,
                            compute_type=self._compute_type,
                        )
                    except Exception as e:
                        raise STTServiceError(
                            f"Failed to initialize WhisperModel: {e}"
                        ) from e
        return self._model

    def _transcribe_sync(
        self,
        audio_array: np.ndarray[Any, Any],
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int,
    ) -> list[Utterance]:
        model = self._get_model()
        try:
            segments, _info = model.transcribe(
                audio_array,
                language=self._language,
                beam_size=5,
                vad_filter=True,
                vad_parameters={
                    "min_silence_duration_ms": 500,
                    "speech_pad_ms": 200,
                },
                condition_on_previous_text=False,
                initial_prompt=self._initial_prompt,
            )

            utterances: list[Utterance] = []
            for seg in segments:
                text = seg.text.strip()
                if not text:
                    continue
                start_ms = start_offset_ms + int(seg.start * 1000)
                end_ms = start_offset_ms + int(seg.end * 1000)
                utterances.append(
                    Utterance(
                        id=str(uuid.uuid4()),
                        meeting_id=meeting_id,
                        speaker=speaker,
                        text=text,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        is_final=True,
                        created_at=datetime.now(UTC),
                    )
                )
            return utterances
        except Exception as e:
            raise STTServiceError(f"STT transcription failed: {e}") from e

    async def transcribe(
        self,
        audio_data: bytes,
        sample_rate: int,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> list[Utterance]:
        """Transcribe mono 16-bit PCM audio bytes."""
        if len(audio_data) == 0:
            return []

        # Convert 16-bit signed PCM to float32 normalized between [-1.0, 1.0]
        pcm16 = np.frombuffer(audio_data, dtype=np.int16)
        if len(pcm16) == 0:
            return []
        audio_float = pcm16.astype(np.float32) / 32768.0

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self._executor,
            self._transcribe_sync,
            audio_float,
            speaker,
            meeting_id,
            start_offset_ms,
        )
