"""WebSocket audio streaming and transcription endpoint."""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.application.dto import UtteranceDTO
from app.application.use_cases import TranscribeAudioUseCase
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.presentation.deps import get_channel_diarizer, get_transcribe_audio_use_case
from app.presentation.schemas import UtteranceMessage

router = APIRouter()
logger = logging.getLogger(__name__)

# Buffer duration in seconds before running transcription
CHUNK_INTERVAL_SECONDS = 2.0


class AudioStreamSession:
    """Manages audio buffering and transcription for a WebSocket connection."""

    def __init__(
        self,
        meeting_id: str,
        websocket: WebSocket,
        diarizer: ChannelDiarizer,
        transcribe_use_case: TranscribeAudioUseCase,
        chunk_interval_sec: float = CHUNK_INTERVAL_SECONDS,
    ) -> None:
        self.meeting_id = meeting_id
        self.websocket = websocket
        self.diarizer = diarizer
        self.transcribe_use_case = transcribe_use_case
        self.chunk_interval_sec = chunk_interval_sec

        # 4 bytes per stereo sample (2 channels * 2 bytes/sample)
        self.bytes_per_second = diarizer.sample_rate * 4
        self.target_buffer_size = int(self.bytes_per_second * self.chunk_interval_sec)

        self._buffer = bytearray()
        self._elapsed_ms = 0
        self._lock = asyncio.Lock()
        self._is_closed = False

    def mark_closed(self) -> None:
        """Mark session as disconnected to prevent sends on closed socket."""
        self._is_closed = True

    async def handle_message(self, message: Any) -> None:
        """Process an incoming WebSocket message (binary PCM or JSON control)."""
        if self._is_closed:
            return
        if isinstance(message, bytes):
            await self._handle_audio_bytes(message)
        elif isinstance(message, str):
            await self._handle_text_control(message)

    async def _handle_text_control(self, text: str) -> None:
        try:
            data = json.loads(text)
            action = data.get("action")
            if action == "ping":
                await self.websocket.send_json({"type": "pong"})
            elif action == "flush":
                await self.flush()
        except json.JSONDecodeError:
            logger.warning("Received invalid non-JSON text message: %s", text)

    async def _handle_audio_bytes(self, pcm_chunk: bytes) -> None:
        async with self._lock:
            self._buffer.extend(pcm_chunk)
            if len(self._buffer) >= self.target_buffer_size:
                buffer_to_process = bytes(self._buffer)
                self._buffer.clear()
            else:
                buffer_to_process = None

        if buffer_to_process:
            await self._process_stereo_buffer(buffer_to_process)

    async def flush(self) -> None:
        """Process any remaining buffered audio bytes."""
        async with self._lock:
            if not self._buffer:
                return
            buffer_to_process = bytes(self._buffer)
            self._buffer.clear()

        # Align to multiple of 4 bytes
        remainder = len(buffer_to_process) % 4
        if remainder != 0:
            buffer_to_process = buffer_to_process[:-remainder]

        if buffer_to_process:
            await self._process_stereo_buffer(buffer_to_process)

    async def _process_stereo_buffer(self, stereo_bytes: bytes) -> None:
        start_ms = self._elapsed_ms
        # Calculate duration of this chunk in ms
        duration_ms = int((len(stereo_bytes) / self.bytes_per_second) * 1000)
        self._elapsed_ms += duration_ms

        left_chunk, right_chunk = self.diarizer.demux_stereo_pcm(
            stereo_bytes, timestamp_ms=start_ms
        )

        # Transcribe both channels concurrently
        results: tuple[list[UtteranceDTO], list[UtteranceDTO]] = await asyncio.gather(
            self.transcribe_use_case.execute(left_chunk, self.meeting_id),
            self.transcribe_use_case.execute(right_chunk, self.meeting_id),
            return_exceptions=False,
        )

        left_utterances, right_utterances = results
        all_utterances = sorted(
            left_utterances + right_utterances,
            key=lambda u: u.start_ms,
        )

        if self._is_closed:
            return

        for u in all_utterances:
            msg = UtteranceMessage(
                id=u.id,
                meeting_id=u.meeting_id,
                speaker=u.speaker,
                text=u.text,
                start_ms=u.start_ms,
                end_ms=u.end_ms,
                is_final=u.is_final,
                created_at=u.created_at,
            )
            try:
                await self.websocket.send_text(msg.model_dump_json())
            except Exception as e:
                logger.info(
                    "Failed to send utterance message on socket for meeting %s: %s",
                    self.meeting_id,
                    e,
                )
                self.mark_closed()
                break


@router.websocket("/ws/meetings/{meeting_id}/audio")
async def websocket_audio_endpoint(
    websocket: WebSocket,
    meeting_id: str,
    diarizer: ChannelDiarizer = Depends(get_channel_diarizer),
    transcribe_use_case: TranscribeAudioUseCase = Depends(
        get_transcribe_audio_use_case
    ),
) -> None:
    """WebSocket endpoint to receive 2ch stereo PCM audio and stream transcription."""
    await websocket.accept()
    session = AudioStreamSession(
        meeting_id=meeting_id,
        websocket=websocket,
        diarizer=diarizer,
        transcribe_use_case=transcribe_use_case,
    )

    try:
        while True:
            message = await websocket.receive()
            msg_type = message.get("type")
            if msg_type == "websocket.disconnect":
                logger.info(
                    "WebSocket disconnect event received for meeting %s", meeting_id
                )
                session.mark_closed()
                await session.flush()
                break

            if "bytes" in message and message["bytes"] is not None:
                await session.handle_message(message["bytes"])
            elif "text" in message and message["text"] is not None:
                await session.handle_message(message["text"])
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for meeting %s", meeting_id)
        session.mark_closed()
        await session.flush()
    except Exception as e:
        logger.error("Error in audio WebSocket session %s: %s", meeting_id, e)
        session.mark_closed()
        try:
            await session.flush()
        except Exception:
            pass
