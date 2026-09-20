"""OpenAI GPT-Realtime-Whisper adapter for STTService."""

import asyncio
import base64
import json
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Protocol

from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import WebSocketException

from app.domain.exceptions import STTConfigurationError, STTServiceError
from app.domain.models.transcript import Speaker, Utterance
from app.domain.services.stt_service import STTService
from app.infrastructure.stt.pcm import OPENAI_REALTIME_PCM_RATE, resample_pcm16_le

OpenAIRealtimeReceiver = Callable[[], Awaitable[str]]


class OpenAIRealtimeTransport(Protocol):
    """Mockable OpenAI Realtime WebSocket boundary."""

    async def transcribe_committed_pcm(
        self,
        pcm16_le: bytes,
        sample_rate: int,
        language: str,
        model: str,
    ) -> str:
        """Return the final transcript for one committed audio turn."""
        ...


def parse_realtime_event(raw: str) -> dict[str, object]:
    """Parse one Realtime JSON event. Invalid payloads become STTServiceError."""
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise STTServiceError(f"OpenAI Realtime returned invalid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise STTServiceError("OpenAI Realtime event must be a JSON object.")
    return payload


def transcript_from_completed_event(event: dict[str, object]) -> str | None:
    """Return transcript text when the event completes a turn, else None."""
    event_type = event.get("type")
    if event_type == "error":
        error = event.get("error")
        message = "OpenAI Realtime error"
        if isinstance(error, dict):
            raw_message = error.get("message")
            if isinstance(raw_message, str) and raw_message:
                message = raw_message
        raise STTServiceError(message)
    if event_type != "conversation.item.input_audio_transcription.completed":
        return None
    transcript = event.get("transcript")
    if not isinstance(transcript, str):
        return ""
    return transcript.strip()


class WebSocketOpenAIRealtimeTransport:
    """One-shot Realtime transcription session per committed PCM turn."""

    def __init__(
        self,
        api_key: str,
        url: str,
        timeout_seconds: float,
    ) -> None:
        self._api_key = api_key
        self._url = url
        self._timeout_seconds = timeout_seconds

    async def transcribe_committed_pcm(
        self,
        pcm16_le: bytes,
        sample_rate: int,
        language: str,
        model: str,
    ) -> str:
        pcm_24k = resample_pcm16_le(pcm16_le, sample_rate, OPENAI_REALTIME_PCM_RATE)
        if len(pcm_24k) < 2:
            return ""

        connect_url = self._url
        separator = "&" if "?" in connect_url else "?"
        if "intent=" not in connect_url:
            connect_url = f"{connect_url}{separator}intent=transcription"

        session_update = json.dumps(
            {
                "type": "session.update",
                "session": {
                    "type": "transcription",
                    "audio": {
                        "input": {
                            "format": {
                                "type": "audio/pcm",
                                "rate": OPENAI_REALTIME_PCM_RATE,
                            },
                            "transcription": {
                                "model": model,
                                "language": language,
                            },
                            "turn_detection": None,
                        }
                    },
                },
            }
        )
        append_audio = json.dumps(
            {
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm_24k).decode("ascii"),
            }
        )
        commit = json.dumps({"type": "input_audio_buffer.commit"})

        try:
            async with connect(
                connect_url,
                additional_headers={"Authorization": f"Bearer {self._api_key}"},
                open_timeout=self._timeout_seconds,
                close_timeout=self._timeout_seconds,
            ) as websocket:
                receive = _bound_text_receiver(websocket)
                await websocket.send(session_update)
                await _wait_for_session_ready(receive, self._timeout_seconds)
                await websocket.send(append_audio)
                await websocket.send(commit)
                return await _wait_for_completed_transcript(
                    receive,
                    self._timeout_seconds,
                )
        except STTServiceError:
            raise
        except TimeoutError as exc:
            raise STTServiceError("OpenAI Realtime transcription timed out.") from exc
        except (OSError, WebSocketException) as exc:
            raise STTServiceError(f"OpenAI Realtime connection failed: {exc}") from exc


def _bound_text_receiver(websocket: ClientConnection) -> OpenAIRealtimeReceiver:
    async def receive() -> str:
        message = await websocket.recv()
        if not isinstance(message, str):
            raise STTServiceError("OpenAI Realtime sent a non-text frame.")
        return message

    return receive


async def _wait_for_session_ready(
    receive: OpenAIRealtimeReceiver,
    timeout_seconds: float,
) -> None:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while True:
        remaining = deadline - asyncio.get_running_loop().time()
        if remaining <= 0:
            raise TimeoutError
        raw = await asyncio.wait_for(receive(), timeout=remaining)
        event = parse_realtime_event(raw)
        event_type = event.get("type")
        if event_type == "error":
            transcript_from_completed_event(event)
        if event_type == "session.updated":
            return


async def _wait_for_completed_transcript(
    receive: OpenAIRealtimeReceiver,
    timeout_seconds: float,
) -> str:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while True:
        remaining = deadline - asyncio.get_running_loop().time()
        if remaining <= 0:
            raise TimeoutError
        raw = await asyncio.wait_for(receive(), timeout=remaining)
        transcript = transcript_from_completed_event(parse_realtime_event(raw))
        if transcript is not None:
            return transcript


class OpenAIRealtimeWhisperSTTService(STTService):
    """STTService adapter that commits each mono PCM chunk to GPT-Realtime-Whisper."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-realtime-whisper",
        url: str = "wss://api.openai.com/v1/realtime",
        language: str = "ja",
        timeout_seconds: float = 30.0,
        transport: OpenAIRealtimeTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._language = language
        self._model = model
        self._url = url
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def transcribe(
        self,
        audio_data: bytes,
        sample_rate: int,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> list[Utterance]:
        if len(audio_data) < 2:
            return []
        if sample_rate <= 0:
            raise STTServiceError("sample_rate must be positive.")

        transport = self._require_transport()
        try:
            text = await transport.transcribe_committed_pcm(
                pcm16_le=audio_data,
                sample_rate=sample_rate,
                language=self._language,
                model=self._model,
            )
        except STTServiceError:
            raise
        except Exception as exc:
            raise STTServiceError(f"STT transcription failed: {exc}") from exc

        text = text.strip()
        if not text:
            return []

        duration_ms = _pcm16_duration_ms(audio_data, sample_rate)
        return [
            Utterance(
                id=str(uuid.uuid4()),
                meeting_id=meeting_id,
                speaker=speaker,
                text=text,
                start_ms=start_offset_ms,
                end_ms=start_offset_ms + duration_ms,
                is_final=True,
                created_at=datetime.now(UTC),
            )
        ]

    def _require_transport(self) -> OpenAIRealtimeTransport:
        if self._transport is not None:
            return self._transport
        if not self._api_key:
            raise STTConfigurationError(
                "OPENAI_API_KEY is not configured. Speech-to-text requires a "
                "separate OpenAI key from ORCAROUTER_API_KEY."
            )
        self._transport = WebSocketOpenAIRealtimeTransport(
            api_key=self._api_key,
            url=self._url,
            timeout_seconds=self._timeout_seconds,
        )
        return self._transport


def _pcm16_duration_ms(pcm16: bytes, sample_rate: int) -> int:
    frame_count = len(pcm16) // 2
    return int(round(frame_count / sample_rate * 1000))
