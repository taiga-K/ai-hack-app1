"""WebSocket audio streaming and transcription endpoint."""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.application.dto import UtteranceDTO
from app.application.use_cases import AnalyzeDialogueUseCase, TranscribeAudioUseCase
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

        # In-memory dialogue context for this meeting session
        self.dialogue_context = MeetingDialogueContext(meeting_id=meeting_id)
        self._analysis_lock = asyncio.Lock()
        self._background_tasks: set[asyncio.Task[None]] = set()

    async def handle_message(self, message: Any) -> None:
        """Process an incoming WebSocket message (binary PCM or JSON control)."""
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
            elif action == "analyze":
                # Manual trigger for analysis
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

        has_remote_client_speech = False

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
            await self.websocket.send_text(msg.model_dump_json())

            # Append to dialogue context
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

        # If remote client spoke or enough new utterances appeared, run analysis in background
        if all_utterances and self.analyze_dialogue_use_case is not None:
            # Trigger analysis asynchronously so we don't block the audio stream
            task = asyncio.create_task(
                self._trigger_analysis(force=has_remote_client_speech)
            )
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)

    async def _trigger_analysis(self, force: bool = False) -> None:
        """Execute dialogue analysis and broadcast advice messages."""
        if self.analyze_dialogue_use_case is None:
            return

        # Use lock to prevent duplicate concurrent LLM analyses
        if self._analysis_lock.locked():
            return

        async with self._analysis_lock:
            try:
                analysis_result = await self.analyze_dialogue_use_case.execute(
                    context=self.dialogue_context,
                    force_analyze=force,
                )
                for item in analysis_result.advice_items:
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
                    await self.websocket.send_text(advice_msg.model_dump_json())
            except Exception as exc:
                logger.error("Failed to run dialogue analysis: %s", exc)


@router.websocket("/ws/meetings/{meeting_id}/audio")
async def websocket_audio_endpoint(
    websocket: WebSocket,
    meeting_id: str,
    diarizer: ChannelDiarizer = Depends(get_channel_diarizer),
    transcribe_use_case: TranscribeAudioUseCase = Depends(
        get_transcribe_audio_use_case
    ),
    analyze_dialogue_use_case: AnalyzeDialogueUseCase = Depends(
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
            if "bytes" in message and message["bytes"] is not None:
                await session.handle_message(message["bytes"])
            elif "text" in message and message["text"] is not None:
                await session.handle_message(message["text"])
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for meeting %s", meeting_id)
        await session.flush()
    except Exception as e:
        logger.error("Error in audio WebSocket session %s: %s", meeting_id, e)
        try:
            await session.flush()
        except Exception:
            pass
