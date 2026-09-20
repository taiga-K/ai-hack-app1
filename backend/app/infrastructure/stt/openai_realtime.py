"""OpenAI GPT-Realtime-Whisper adapter for STTService."""

import asyncio
import base64
import json
import ssl
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Protocol

import certifi
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosedOK, WebSocketException

from app.domain.exceptions import STTConfigurationError, STTServiceError
from app.domain.models.transcript import Speaker, Utterance
from app.domain.services.stt_service import STTService, STTSession
from app.infrastructure.stt.pcm import (
    OPENAI_REALTIME_PCM_RATE,
    SpeechTurnTracker,
    pcm16_has_speech,
    resample_pcm16_le,
)

OpenAIRealtimeReceiver = Callable[[], Awaitable[str]]
OPENAI_STT_DELAYS = frozenset({"minimal", "low", "medium", "high", "xhigh"})
OPENAI_MIN_COMMIT_MS = 100
OPENAI_COMMIT_FLOOR_MS = 200


def realtime_ssl_context() -> ssl.SSLContext:
    """TLS context using certifi. Default macOS CPython CA lists are empty."""
    return ssl.create_default_context(cafile=certifi.where())


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


def transcription_session_update(
    *,
    model: str,
    language: str,
    delay: str,
) -> str:
    """Build the official transcription session.update payload."""
    return json.dumps(
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
                            "delay": delay,
                        },
                        "turn_detection": None,
                    }
                },
            },
        }
    )


def realtime_connect_url(url: str) -> str:
    """Attach intent=transcription when the caller omitted it."""
    if "intent=" in url:
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}intent=transcription"


class WebSocketOpenAIRealtimeTransport:
    """One-shot Realtime transcription session for a finished PCM buffer."""

    def __init__(
        self,
        api_key: str,
        url: str,
        timeout_seconds: float,
        delay: str = "high",
    ) -> None:
        self._api_key = api_key
        self._url = url
        self._timeout_seconds = timeout_seconds
        self._delay = delay

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

        connect_url = realtime_connect_url(self._url)
        append_audio = json.dumps(
            {
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm_24k).decode("ascii"),
            }
        )
        commit = json.dumps({"type": "input_audio_buffer.commit"})
        ssl_context = realtime_ssl_context()
        try:
            async with connect(
                connect_url,
                additional_headers={"Authorization": f"Bearer {self._api_key}"},
                ssl=ssl_context,
                open_timeout=self._timeout_seconds,
                close_timeout=self._timeout_seconds,
            ) as websocket:
                receive = _bound_text_receiver(websocket)
                await websocket.send(
                    transcription_session_update(
                        model=model,
                        language=language,
                        delay=self._delay,
                    )
                )
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


class PersistentOpenAIRealtimeSession:
    """Official live session. Append continuously. Commit on turn boundaries."""

    def __init__(
        self,
        api_key: str,
        url: str,
        timeout_seconds: float,
        language: str,
        model: str,
        delay: str,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int,
    ) -> None:
        self._api_key = api_key
        self._url = url
        self._timeout_seconds = timeout_seconds
        self._language = language
        self._model = model
        self._delay = delay
        self._speaker = speaker
        self._meeting_id = meeting_id
        self._elapsed_ms = start_offset_ms
        self._item_start_ms = start_offset_ms
        self._websocket: ClientConnection | None = None
        self._runner: asyncio.Task[None] | None = None
        self._ready = asyncio.Event()
        self._start_error: Exception | None = None
        self._pending: list[Utterance] = []
        self._partials: dict[str, str] = {}
        self._has_uncommitted_audio = False
        self._uncommitted_ms = 0.0
        self._commits_in_flight = 0
        self._pending_windows: list[tuple[int, int]] = []
        self._windows_by_item: dict[str, tuple[int, int]] = {}
        self._turn_committed = asyncio.Event()
        self._closed = False
        self._send_lock = asyncio.Lock()
        self._turn_tracker = SpeechTurnTracker()

    async def append(self, audio_data: bytes, sample_rate: int) -> list[Utterance]:
        if self._closed:
            return []
        if len(audio_data) < 2:
            return self._drain()
        if sample_rate <= 0:
            raise STTServiceError("sample_rate must be positive.")
        pcm_24k = resample_pcm16_le(audio_data, sample_rate, OPENAI_REALTIME_PCM_RATE)
        if len(pcm_24k) < 2:
            return self._drain()
        await self._ensure_started()
        websocket = self._require_websocket()
        append_audio = json.dumps(
            {
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm_24k).decode("ascii"),
            }
        )
        async with self._send_lock:
            await websocket.send(append_audio)
        if not self._has_uncommitted_audio:
            self._item_start_ms = self._elapsed_ms
        self._elapsed_ms += _pcm16_duration_ms(audio_data, sample_rate)
        self._uncommitted_ms += (len(pcm_24k) // 2) * 1000.0 / OPENAI_REALTIME_PCM_RATE
        if pcm16_has_speech(audio_data):
            self._has_uncommitted_audio = True
        if self._turn_tracker.observe(audio_data, sample_rate):
            await self._commit_open_turn(wait=False)
        return self._drain()

    async def commit(self, *, wait: bool = False) -> list[Utterance]:
        if self._closed:
            return self._drain()
        await self._commit_open_turn(wait=wait)
        return self._drain()

    async def close(self) -> list[Utterance]:
        if self._closed:
            return self._drain()
        self._closed = True
        await self._commit_open_turn(wait=True)
        websocket = self._websocket
        if websocket is not None:
            await websocket.close()
        runner = self._runner
        if runner is not None:
            await asyncio.gather(runner, return_exceptions=True)
        return self._drain()

    async def _commit_open_turn(self, *, wait: bool) -> None:
        websocket = self._websocket
        if websocket is None:
            return
        minimum_ms = OPENAI_MIN_COMMIT_MS if wait else OPENAI_COMMIT_FLOOR_MS
        if self._has_uncommitted_audio and self._uncommitted_ms >= minimum_ms:
            window = (self._item_start_ms, self._elapsed_ms)
            self._turn_tracker.reset()
            self._turn_committed.clear()
            self._pending_windows.append(window)
            self._has_uncommitted_audio = False
            self._commits_in_flight += 1
            try:
                async with self._send_lock:
                    await websocket.send(
                        json.dumps({"type": "input_audio_buffer.commit"})
                    )
            except (OSError, WebSocketException):
                if self._pending_windows:
                    self._pending_windows.pop()
                self._commits_in_flight = max(0, self._commits_in_flight - 1)
                self._has_uncommitted_audio = True
                raise
            self._uncommitted_ms = 0.0
        if not wait:
            return
        while self._commits_in_flight > 0:
            self._turn_committed.clear()
            try:
                await asyncio.wait_for(
                    self._turn_committed.wait(),
                    timeout=self._timeout_seconds,
                )
            except TimeoutError:
                self._commits_in_flight = 0
                return

    async def _ensure_started(self) -> None:
        if self._runner is None:
            self._runner = asyncio.create_task(self._run_connection())
        await self._ready.wait()
        if self._start_error is not None:
            raise self._start_error

    async def _run_connection(self) -> None:
        connect_url = realtime_connect_url(self._url)
        try:
            async with connect(
                connect_url,
                additional_headers={"Authorization": f"Bearer {self._api_key}"},
                ssl=realtime_ssl_context(),
                open_timeout=self._timeout_seconds,
                close_timeout=self._timeout_seconds,
            ) as websocket:
                self._websocket = websocket
                receive = _bound_text_receiver(websocket)
                await websocket.send(
                    transcription_session_update(
                        model=self._model,
                        language=self._language,
                        delay=self._delay,
                    )
                )
                await _wait_for_session_ready(receive, self._timeout_seconds)
                self._ready.set()
                while True:
                    raw = await receive()
                    self._handle_event(parse_realtime_event(raw))
        except ConnectionClosedOK:
            return
        except STTServiceError as exc:
            self._fail_start(exc)
        except TimeoutError as exc:
            self._fail_start(
                STTServiceError("OpenAI Realtime transcription timed out.")
            )
            raise STTServiceError("OpenAI Realtime transcription timed out.") from exc
        except (OSError, WebSocketException) as exc:
            if self._closed:
                return
            wrapped = STTServiceError(f"OpenAI Realtime connection failed: {exc}")
            self._fail_start(wrapped)
        finally:
            self._websocket = None
            self._ready.set()

    def _fail_start(self, error: Exception) -> None:
        if self._start_error is None:
            self._start_error = error
        self._ready.set()

    def _handle_event(self, event: dict[str, object]) -> None:
        event_type = event.get("type")
        if event_type == "error":
            transcript_from_completed_event(event)
            return
        item_id = event.get("item_id")
        if not isinstance(item_id, str) or not item_id:
            item_id = str(uuid.uuid4())
        if event_type == "input_audio_buffer.committed":
            if self._pending_windows:
                self._windows_by_item[item_id] = self._pending_windows.pop(0)
            return
        if event_type == "conversation.item.input_audio_transcription.delta":
            delta = event.get("delta")
            if not isinstance(delta, str) or not delta:
                return
            text = self._partials.get(item_id, "") + delta
            self._partials[item_id] = text
            self._pending.append(self._utterance(item_id, text, is_final=False))
            return
        if event_type == "conversation.item.input_audio_transcription.failed":
            self._partials.pop(item_id, None)
            self._finish_committed_item(item_id)
            return
        completed = transcript_from_completed_event(event)
        if completed is None:
            return
        self._partials.pop(item_id, None)
        window = self._finish_committed_item(item_id)
        if not completed:
            return
        start_ms, end_ms = window or (self._item_start_ms, self._elapsed_ms)
        self._pending.append(
            self._utterance(
                item_id,
                completed,
                start_ms=start_ms,
                end_ms=end_ms,
                is_final=True,
            )
        )

    def _finish_committed_item(self, item_id: str) -> tuple[int, int] | None:
        window = self._windows_by_item.pop(item_id, None)
        if window is None and self._pending_windows:
            window = self._pending_windows.pop(0)
        self._commits_in_flight = max(0, self._commits_in_flight - 1)
        self._turn_committed.set()
        return window

    def _utterance(
        self,
        item_id: str,
        text: str,
        *,
        is_final: bool,
        start_ms: int | None = None,
        end_ms: int | None = None,
    ) -> Utterance:
        return Utterance(
            id=item_id,
            meeting_id=self._meeting_id,
            speaker=self._speaker,
            text=text,
            start_ms=self._item_start_ms if start_ms is None else start_ms,
            end_ms=self._elapsed_ms if end_ms is None else end_ms,
            is_final=is_final,
            created_at=datetime.now(UTC),
        )

    def _drain(self) -> list[Utterance]:
        if self._start_error is not None:
            raise self._start_error
        pending = self._pending
        self._pending = []
        return pending

    def _require_websocket(self) -> ClientConnection:
        websocket = self._websocket
        if websocket is None:
            raise STTServiceError("OpenAI Realtime connection is not open.")
        return websocket


class _BufferedTransportSession:
    """Test double path. Buffer appends and commit once on close."""

    def __init__(
        self,
        transport: OpenAIRealtimeTransport,
        language: str,
        model: str,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int,
    ) -> None:
        self._transport = transport
        self._language = language
        self._model = model
        self._speaker = speaker
        self._meeting_id = meeting_id
        self._start_offset_ms = start_offset_ms
        self._sample_rate = 16000
        self._buffer = bytearray()

    async def append(self, audio_data: bytes, sample_rate: int) -> list[Utterance]:
        if sample_rate <= 0:
            raise STTServiceError("sample_rate must be positive.")
        self._sample_rate = sample_rate
        self._buffer.extend(audio_data)
        return []

    async def commit(self, *, wait: bool = False) -> list[Utterance]:
        return []

    async def close(self) -> list[Utterance]:
        pcm = bytes(self._buffer)
        self._buffer.clear()
        if len(pcm) < 2:
            return []
        text = await self._transport.transcribe_committed_pcm(
            pcm16_le=pcm,
            sample_rate=self._sample_rate,
            language=self._language,
            model=self._model,
        )
        text = text.strip()
        if not text:
            return []
        duration_ms = _pcm16_duration_ms(pcm, self._sample_rate)
        return [
            Utterance(
                id=str(uuid.uuid4()),
                meeting_id=self._meeting_id,
                speaker=self._speaker,
                text=text,
                start_ms=self._start_offset_ms,
                end_ms=self._start_offset_ms + duration_ms,
                is_final=True,
                created_at=datetime.now(UTC),
            )
        ]


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
    """STTService adapter that streams PCM into one GPT-Realtime-Whisper session."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-realtime-whisper",
        url: str = "wss://api.openai.com/v1/realtime",
        language: str = "ja",
        timeout_seconds: float = 30.0,
        delay: str = "high",
        transport: OpenAIRealtimeTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._language = language
        self._model = model
        self._url = url
        self._timeout_seconds = timeout_seconds
        self._delay = delay
        self._transport = transport

    def open_session(
        self,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> STTSession:
        if self._transport is not None:
            return _BufferedTransportSession(
                transport=self._transport,
                language=self._language,
                model=self._model,
                speaker=speaker,
                meeting_id=meeting_id,
                start_offset_ms=start_offset_ms,
            )
        if not self._api_key:
            raise STTConfigurationError(
                "OPENAI_API_KEY is not configured. Speech-to-text requires a "
                "separate OpenAI key from ORCAROUTER_API_KEY."
            )
        return PersistentOpenAIRealtimeSession(
            api_key=self._api_key,
            url=self._url,
            timeout_seconds=self._timeout_seconds,
            language=self._language,
            model=self._model,
            delay=self._delay,
            speaker=speaker,
            meeting_id=meeting_id,
            start_offset_ms=start_offset_ms,
        )

    async def transcribe(
        self,
        audio_data: bytes,
        sample_rate: int,
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> list[Utterance]:
        session = self.open_session(
            speaker=speaker,
            meeting_id=meeting_id,
            start_offset_ms=start_offset_ms,
        )
        await session.append(audio_data, sample_rate)
        return await session.close()


def _pcm16_duration_ms(pcm16: bytes, sample_rate: int) -> int:
    frame_count = len(pcm16) // 2
    return int(round(frame_count / sample_rate * 1000))
