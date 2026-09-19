"""WebSocket audio streaming, transcription, and advice endpoint."""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.application.dto import UtteranceDTO
from app.application.use_cases import AnalyzeDialogueUseCase, TranscribeAudioUseCase
from app.domain.exceptions import AudioProcessingError, STTServiceError
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.transcript import Speaker, Utterance
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.presentation.deps import (
    get_analyze_dialogue_use_case,
    get_channel_diarizer,
    get_transcribe_audio_use_case,
)
from app.presentation.schemas import AdviceMessage, UtteranceMessage

router = APIRouter()
logger = logging.getLogger(__name__)

# Buffer duration in seconds before running transcription
CHUNK_INTERVAL_SECONDS = 2.0


class AudioStreamSession:
    """Manages audio buffering, transcription, and real-time advice for a WebSocket connection."""

    def __init__(
        self,
        meeting_id: str,
        websocket: WebSocket,
        diarizer: ChannelDiarizer,
        transcribe_use_case: TranscribeAudioUseCase,
        analyze_dialogue_use_case: AnalyzeDialogueUseCase | None = None,
        chunk_interval_sec: float = CHUNK_INTERVAL_SECONDS,
    ) -> None:
        self.meeting_id = meeting_id
        self.websocket = websocket
        self.diarizer = diarizer
        self.transcribe_use_case = transcribe_use_case
        self.analyze_dialogue_use_case = analyze_dialogue_use_case
        self.chunk_interval_sec = chunk_interval_sec

        # 4 bytes per stereo sample (2 channels * 2 bytes/sample)
        self.bytes_per_second = diarizer.sample_rate * 4
        self.target_buffer_size = int(self.bytes_per_second * self.chunk_interval_sec)

        self._buffer = bytearray()
        self._elapsed_ms = 0
        self._lock = asyncio.Lock()
        self._is_closed = False

        # Shared send lock to prevent interleaved ASGI WebSocket frames
        self._send_lock = asyncio.Lock()

        # In-memory dialogue context for this meeting session
        self.dialogue_context = MeetingDialogueContext(meeting_id=meeting_id)
        self._analysis_lock = asyncio.Lock()
        self._analysis_pending = False
        self._analysis_pending_force = False
        self._seen_advice_ids: set[str] = set()
        self._background_tasks: set[asyncio.Task[None]] = set()

    def mark_closed(self) -> None:
        """Mark session as disconnected to prevent sends on closed socket."""
        self._is_closed = True

    async def _safe_send_text(self, text: str) -> bool:
        """Safely send text message over WebSocket serialized with send lock."""
        if self._is_closed:
            return False
        async with self._send_lock:
            if self._is_closed:
                return False
            try:
                await self.websocket.send_text(text)
                return True
            except Exception as e:
                logger.info(
                    "Failed to send text message on socket for meeting %s: %s",
                    self.meeting_id,
                    e,
                )
                self.mark_closed()
                return False

    async def _safe_send_json(self, data: Any) -> bool:
        """Safely send JSON message over WebSocket serialized with send lock."""
        if self._is_closed:
            return False
        async with self._send_lock:
            if self._is_closed:
                return False
            try:
                await self.websocket.send_json(data)
                return True
            except Exception as e:
                logger.info(
                    "Failed to send JSON message on socket for meeting %s: %s",
                    self.meeting_id,
                    e,
                )
                self.mark_closed()
                return False

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
                await self._safe_send_json({"type": "pong"})
            elif action == "flush":
                await self.flush()
            elif action == "analyze":
                await self._trigger_analysis(force=True)
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

        try:
            left_chunk, right_chunk = self.diarizer.demux_stereo_pcm(
                stereo_bytes, timestamp_ms=start_ms
            )

            results: tuple[
                list[UtteranceDTO], list[UtteranceDTO]
            ] = await asyncio.gather(
                self.transcribe_use_case.execute(left_chunk, self.meeting_id),
                self.transcribe_use_case.execute(right_chunk, self.meeting_id),
                return_exceptions=False,
            )
        except (STTServiceError, AudioProcessingError) as e:
            logger.warning(
                "Skipping audio chunk for meeting %s due to processing error: %s",
                self.meeting_id,
                e,
            )
            return
        except Exception as e:
            logger.error(
                "Unexpected error processing audio chunk for meeting %s: %s",
                self.meeting_id,
                e,
            )
            return

        left_utterances, right_utterances = results
        all_utterances = sorted(
            left_utterances + right_utterances,
            key=lambda u: u.start_ms,
        )

        has_remote_client_speech = False

        for u in all_utterances:
            if self._is_closed:
                return

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
            sent = await self._safe_send_text(msg.model_dump_json())
            if not sent:
                return

            speaker_enum = (
                Speaker.LOCAL_PM
                if u.speaker == Speaker.LOCAL_PM.value
                else Speaker.REMOTE_CLIENT
            )
            if speaker_enum == Speaker.REMOTE_CLIENT:
                has_remote_client_speech = True

            self.dialogue_context.add_utterance(
                Utterance(
                    id=u.id,
                    meeting_id=u.meeting_id,
                    speaker=speaker_enum,
                    text=u.text,
                    start_ms=u.start_ms,
                    end_ms=u.end_ms,
                    is_final=u.is_final,
                    created_at=u.created_at,
                )
            )

        if (
            all_utterances
            and self.analyze_dialogue_use_case is not None
            and not self._is_closed
        ):
            task = asyncio.create_task(
                self._trigger_analysis(force=has_remote_client_speech)
            )
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)

    async def _trigger_analysis(self, force: bool = False) -> None:
        """Execute dialogue analysis and broadcast advice messages with retry queuing."""
        if self.analyze_dialogue_use_case is None or self._is_closed:
            return

        # If analysis is already running, queue a follow-up retry with accumulated speech
        if self._analysis_lock.locked():
            self._analysis_pending = True
            if force:
                self._analysis_pending_force = True
            return

        async with self._analysis_lock:
            current_force = force
            while True:
                if self._is_closed:
                    return
                # Reset pending flags before executing analysis run
                self._analysis_pending = False
                force_to_use = current_force or self._analysis_pending_force
                self._analysis_pending_force = False

                try:
                    analysis_result = await self.analyze_dialogue_use_case.execute(
                        context=self.dialogue_context,
                        force_analyze=force_to_use,
                    )
                    for item in analysis_result.advice_items:
                        if self._is_closed:
                            return
                        # Deduplicate: do not rebroadcast already sent advice
                        if item.id in self._seen_advice_ids:
                            continue
                        self._seen_advice_ids.add(item.id)

                        advice_msg = AdviceMessage(
                            id=item.id,
                            meeting_id=self.meeting_id,
                            category=item.category,
                            priority=item.priority,
                            title=item.title,
                            reason=item.reason,
                            suggested_question=item.suggested_question,
                            detected_at=item.detected_at,
                            quote=item.quote,
                        )
                        sent = await self._safe_send_text(advice_msg.model_dump_json())
                        if not sent:
                            return
                except Exception as exc:
                    logger.error("Failed to run dialogue analysis: %s", exc)

                # If new utterances arrived while analysis was in flight, run again
                if self._analysis_pending and not self._is_closed:
                    current_force = self._analysis_pending_force
                    continue
                break


@router.websocket("/ws/meetings/{meeting_id}/audio")
async def websocket_audio_endpoint(
    websocket: WebSocket,
    meeting_id: str,
    diarizer: ChannelDiarizer = Depends(get_channel_diarizer),
    transcribe_use_case: TranscribeAudioUseCase = Depends(
        get_transcribe_audio_use_case
    ),
    analyze_dialogue_use_case: AnalyzeDialogueUseCase | None = Depends(
        get_analyze_dialogue_use_case
    ),
) -> None:
    """WebSocket endpoint to receive 2ch stereo PCM audio and stream transcription and advice."""
    await websocket.accept()
    session = AudioStreamSession(
        meeting_id=meeting_id,
        websocket=websocket,
        diarizer=diarizer,
        transcribe_use_case=transcribe_use_case,
        analyze_dialogue_use_case=analyze_dialogue_use_case,
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
