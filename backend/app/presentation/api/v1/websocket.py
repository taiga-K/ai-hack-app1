"""WebSocket audio streaming, transcription, and advice endpoint."""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.application.dto import AdviceItemDTO, UtteranceDTO
from app.application.use_cases import (
    AnalyzeDialogueUseCase,
    TranscribeAudioUseCase,
    UpdateMindMapUseCase,
)
from app.application.use_cases.generate_requirements_doc import parse_seed_advice_item
from app.application.use_cases.transcribe_audio import TranscriptStream
from app.domain.exceptions import AudioProcessingError, STTServiceError
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.mind_map import (
    MindMapNode,
    MindMapSilenceBuffer,
    MindMapSnapshot,
)
from app.domain.models.transcript import Speaker, Utterance
from app.domain.services.meeting_session_repository import MeetingSessionRepository
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.infrastructure.stt.pcm import pcm16_has_speech, pcm16_is_dominant
from app.presentation.deps import (
    get_analyze_dialogue_use_case,
    get_channel_diarizer,
    get_meeting_session_repository,
    get_transcribe_audio_use_case,
    get_update_mind_map_use_case,
)
from app.presentation.schemas import (
    AdviceMessage,
    MindMapMessage,
    MindMapNodeMessage,
    UtteranceMessage,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class AudioStreamSession:
    """Manages audio streaming, transcription, and real-time advice for a WebSocket connection."""

    def __init__(
        self,
        meeting_id: str,
        websocket: WebSocket,
        diarizer: ChannelDiarizer,
        transcribe_use_case: TranscribeAudioUseCase,
        analyze_dialogue_use_case: AnalyzeDialogueUseCase | None = None,
        update_mind_map_use_case: UpdateMindMapUseCase | None = None,
        meeting_session_repository: MeetingSessionRepository | None = None,
    ) -> None:
        self.meeting_id = meeting_id
        self.websocket = websocket
        self.diarizer = diarizer
        self.transcribe_use_case = transcribe_use_case
        self.analyze_dialogue_use_case = analyze_dialogue_use_case
        self.update_mind_map_use_case = update_mind_map_use_case

        # 4 bytes per stereo sample (2 channels * 2 bytes/sample)
        self.bytes_per_second = diarizer.sample_rate * 4

        self._buffer = bytearray()
        self._elapsed_ms = 0
        self._lock = asyncio.Lock()
        self._is_closed = False

        # Shared send lock to prevent interleaved ASGI WebSocket frames
        self._send_lock = asyncio.Lock()

        # In-memory dialogue context for this meeting session
        self.dialogue_context = MeetingDialogueContext(meeting_id=meeting_id)
        self.meeting_session_repository = meeting_session_repository
        self._close_persist_started = False
        self._mind_map = MindMapSnapshot(meeting_id=meeting_id, revision=0)
        if self.meeting_session_repository is not None:
            record = self.meeting_session_repository.get_or_create(meeting_id)
            self.meeting_session_repository.register_live_session(meeting_id)
            # Keep the persisted transcript so the restored watermark is not ahead
            # of an empty dialogue (reconnect / ききはじめる again).
            self.dialogue_context = record.dialogue
            if record.mind_map is not None:
                self._mind_map = self._align_mind_map_watermark(
                    record.mind_map,
                    self.dialogue_context.total_utterances,
                )
        self._analysis_lock = asyncio.Lock()
        self._analysis_pending = False
        self._analysis_pending_force = False
        self._seen_advice_ids: set[str] = set()
        self._background_tasks: set[asyncio.Task[None]] = set()
        self._mind_map_lock = asyncio.Lock()
        self._mind_map_pending = False
        self._mind_map_pending_force = False
        self._mind_map_pending_windows: list[tuple[Utterance, ...]] = []
        self._mind_map_buffer = MindMapSilenceBuffer()
        self._local_stream: TranscriptStream | None = None
        self._remote_stream: TranscriptStream | None = None

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
                if self.analyze_dialogue_use_case is not None and not self._is_closed:
                    self._schedule_analysis(force=True)
                if self.update_mind_map_use_case is not None and not self._is_closed:
                    self._schedule_mind_map_flush(force=True)
        except json.JSONDecodeError:
            logger.warning("Received invalid non-JSON text message: %s", text)

    async def _handle_audio_bytes(self, pcm_chunk: bytes) -> None:
        async with self._lock:
            self._buffer.extend(pcm_chunk)
            aligned = len(self._buffer) - (len(self._buffer) % 4)
            if aligned == 0:
                return
            buffer_to_process = bytes(self._buffer[:aligned])
            del self._buffer[:aligned]

        await self._process_stereo_buffer(buffer_to_process)

    async def flush(self) -> None:
        """Push leftover PCM, then commit the open Realtime turns."""
        async with self._lock:
            buffer_to_process = bytes(self._buffer)
            self._buffer.clear()

        remainder = len(buffer_to_process) % 4
        if remainder != 0:
            buffer_to_process = buffer_to_process[:-remainder]
        if buffer_to_process:
            await self._process_stereo_buffer(buffer_to_process)
        await self._finalize_transcript_streams(close_streams=False, wait=True)

    def _stream_for(self, speaker: Speaker) -> TranscriptStream:
        if speaker == Speaker.LOCAL_PM:
            if self._local_stream is None:
                self._local_stream = self.transcribe_use_case.open_stream(
                    speaker=speaker,
                    meeting_id=self.meeting_id,
                    start_offset_ms=self._elapsed_ms,
                )
            return self._local_stream
        if self._remote_stream is None:
            self._remote_stream = self.transcribe_use_case.open_stream(
                speaker=speaker,
                meeting_id=self.meeting_id,
                start_offset_ms=self._elapsed_ms,
            )
        return self._remote_stream

    async def _finalize_transcript_streams(
        self, *, close_streams: bool, wait: bool = False
    ) -> None:
        streams = [self._local_stream, self._remote_stream]
        if close_streams:
            self._local_stream = None
            self._remote_stream = None
        open_streams = [stream for stream in streams if stream is not None]
        if not open_streams:
            return
        operations = [
            stream.close() if close_streams else stream.commit(wait=wait)
            for stream in open_streams
        ]
        results = await asyncio.gather(*operations, return_exceptions=True)
        all_utterances: list[UtteranceDTO] = []
        for result in results:
            if isinstance(result, BaseException):
                logger.warning(
                    "Skipping one transcript stream for meeting %s: %s",
                    self.meeting_id,
                    result,
                )
                continue
            all_utterances.extend(result)
        all_utterances.sort(key=lambda u: u.start_ms)
        if all_utterances:
            await self._publish_closed_utterances(all_utterances)

    def _drop_stream(self, speaker: Speaker) -> None:
        if speaker == Speaker.LOCAL_PM:
            stream = self._local_stream
            self._local_stream = None
        else:
            stream = self._remote_stream
            self._remote_stream = None
        if stream is None:
            return
        task = asyncio.create_task(self._close_dropped_stream(stream))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    async def _close_dropped_stream(self, stream: TranscriptStream) -> None:
        try:
            utterances = await stream.close()
        except (STTServiceError, AudioProcessingError) as exc:
            logger.warning(
                "Failed to close dropped transcript stream for meeting %s: %s",
                self.meeting_id,
                exc,
            )
            return
        if utterances:
            await self._publish_closed_utterances(utterances)

    def _utterances_or_drop(
        self,
        result: list[UtteranceDTO] | BaseException,
        speaker: Speaker,
    ) -> list[UtteranceDTO]:
        if isinstance(result, BaseException):
            logger.warning(
                "Dropping %s transcript stream for meeting %s: %s",
                speaker.value,
                self.meeting_id,
                result,
            )
            self._drop_stream(speaker)
            return []
        return result

    async def _commit_or_error(
        self, stream: TranscriptStream
    ) -> list[UtteranceDTO] | BaseException:
        try:
            return await stream.commit()
        except (STTServiceError, AudioProcessingError) as exc:
            return exc

    async def _publish_closed_utterances(
        self, all_utterances: list[UtteranceDTO]
    ) -> None:
        self._begin_persist_work()
        try:
            has_remote_client_speech = False
            for u in all_utterances:
                speaker_enum = (
                    Speaker.LOCAL_PM
                    if u.speaker == Speaker.LOCAL_PM.value
                    else Speaker.REMOTE_CLIENT
                )
                if speaker_enum == Speaker.REMOTE_CLIENT and u.is_final:
                    has_remote_client_speech = True
                utterance = Utterance(
                    id=u.id,
                    meeting_id=u.meeting_id,
                    speaker=speaker_enum,
                    text=u.text,
                    start_ms=u.start_ms,
                    end_ms=u.end_ms,
                    is_final=u.is_final,
                    created_at=u.created_at,
                )
                if u.is_final:
                    added = self.dialogue_context.add_utterance(utterance)
                    if added:
                        self._accumulate_mind_map_utterance(u.id)
                    if self.meeting_session_repository is not None:
                        self.meeting_session_repository.add_utterance(
                            self.meeting_id, utterance
                        )
                if not self._is_closed:
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
                    await self._safe_send_text(msg.model_dump_json())
            finals = [item for item in all_utterances if item.is_final]
            if finals and self.analyze_dialogue_use_case is not None:
                await self._trigger_analysis(force=has_remote_client_speech)
            if self.update_mind_map_use_case is not None:
                await self._flush_mind_map_now(force=True)
        finally:
            self._end_persist_work()

    def _begin_persist_work(self) -> None:
        if self.meeting_session_repository is not None:
            self.meeting_session_repository.begin_persist_work(self.meeting_id)

    def _end_persist_work(self) -> None:
        if self.meeting_session_repository is not None:
            self.meeting_session_repository.end_persist_work(self.meeting_id)

    async def _process_stereo_buffer(self, stereo_bytes: bytes) -> None:
        self._begin_persist_work()
        try:
            await self._process_stereo_buffer_body(stereo_bytes)
        finally:
            self._end_persist_work()

    async def _process_stereo_buffer_body(self, stereo_bytes: bytes) -> None:
        start_ms = self._elapsed_ms
        # Calculate duration of this chunk in ms
        duration_ms = int((len(stereo_bytes) / self.bytes_per_second) * 1000)
        self._elapsed_ms += duration_ms

        try:
            left_chunk, right_chunk = self.diarizer.demux_stereo_pcm(
                stereo_bytes, timestamp_ms=start_ms
            )
            self._observe_mind_map_audio(
                speech=pcm16_has_speech(left_chunk.data)
                or pcm16_has_speech(right_chunk.data),
                duration_ms=duration_ms,
            )
            local_stream = self._stream_for(Speaker.LOCAL_PM)
            remote_stream = self._stream_for(Speaker.REMOTE_CLIENT)
            left_result, right_result = await asyncio.gather(
                local_stream.append(left_chunk),
                remote_stream.append(right_chunk),
                return_exceptions=True,
            )
            left_utterances = self._utterances_or_drop(left_result, Speaker.LOCAL_PM)
            right_utterances = self._utterances_or_drop(
                right_result, Speaker.REMOTE_CLIENT
            )
            if (
                pcm16_is_dominant(left_chunk.data, right_chunk.data)
                and self._remote_stream is not None
            ):
                right_utterances = [
                    *right_utterances,
                    *self._utterances_or_drop(
                        await self._commit_or_error(self._remote_stream),
                        Speaker.REMOTE_CLIENT,
                    ),
                ]
            if (
                pcm16_is_dominant(right_chunk.data, left_chunk.data)
                and self._local_stream is not None
            ):
                left_utterances = [
                    *left_utterances,
                    *self._utterances_or_drop(
                        await self._commit_or_error(self._local_stream),
                        Speaker.LOCAL_PM,
                    ),
                ]
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
        all_utterances = sorted(
            left_utterances + right_utterances,
            key=lambda u: u.start_ms,
        )

        has_remote_client_speech = False

        for u in all_utterances:
            speaker_enum = (
                Speaker.LOCAL_PM
                if u.speaker == Speaker.LOCAL_PM.value
                else Speaker.REMOTE_CLIENT
            )
            if speaker_enum == Speaker.REMOTE_CLIENT and u.is_final:
                has_remote_client_speech = True

            utterance = Utterance(
                id=u.id,
                meeting_id=u.meeting_id,
                speaker=speaker_enum,
                text=u.text,
                start_ms=u.start_ms,
                end_ms=u.end_ms,
                is_final=u.is_final,
                created_at=u.created_at,
            )
            if u.is_final:
                added = self.dialogue_context.add_utterance(utterance)
                if added:
                    self._accumulate_mind_map_utterance(u.id)
                if self.meeting_session_repository is not None:
                    self.meeting_session_repository.add_utterance(
                        self.meeting_id, utterance
                    )

            if self._is_closed:
                continue

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
            await self._safe_send_text(msg.model_dump_json())

        final_utterances = [item for item in all_utterances if item.is_final]
        if final_utterances and self.analyze_dialogue_use_case is not None:
            if self._is_closed:
                # Disconnect flush: persist last detections even if the socket is gone.
                await self._trigger_analysis(force=has_remote_client_speech)
            else:
                self._schedule_analysis(force=has_remote_client_speech)

        if self.update_mind_map_use_case is not None:
            if self._is_closed:
                await self._flush_mind_map_now(force=True)
            elif self._mind_map_buffer.should_flush():
                self._schedule_mind_map_flush(force=False)

    def _schedule_analysis(self, force: bool) -> None:
        """Start analysis without a persist-count gap after STT returns."""
        self._begin_persist_work()
        task = asyncio.create_task(self._run_scheduled_analysis(force))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    async def _run_scheduled_analysis(self, force: bool) -> None:
        try:
            await self._trigger_analysis(force)
        finally:
            self._end_persist_work()

    async def _trigger_analysis(self, force: bool = False) -> None:
        """Analyze dialogue, persist detections, and broadcast while the socket is open."""
        if self.analyze_dialogue_use_case is None:
            return

        # If analysis is already running, queue a follow-up retry with accumulated speech
        if self._analysis_lock.locked():
            self._analysis_pending = True
            if force:
                self._analysis_pending_force = True
            return

        self._begin_persist_work()
        try:
            await self._run_analysis_loop(force)
        finally:
            self._end_persist_work()

    async def _run_analysis_loop(self, force: bool) -> None:
        use_case = self.analyze_dialogue_use_case
        if use_case is None:
            return
        async with self._analysis_lock:
            current_force = force
            while True:
                # Reset pending flags before executing analysis run
                self._analysis_pending = False
                force_to_use = current_force or self._analysis_pending_force
                self._analysis_pending_force = False

                try:
                    analysis_result = await use_case.execute(
                        context=self.dialogue_context,
                        force_analyze=force_to_use,
                    )
                    for item in analysis_result.advice_items:
                        # Deduplicate: do not rebroadcast already sent advice
                        if item.id in self._seen_advice_ids:
                            continue
                        self._seen_advice_ids.add(item.id)
                        self._persist_advice(item)

                        if self._is_closed:
                            continue

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
                        await self._safe_send_text(advice_msg.model_dump_json())
                except Exception as exc:
                    logger.error("Failed to run dialogue analysis: %s", exc)

                # Drain queued speech even after disconnect so finalize sees last detections
                if self._analysis_pending:
                    current_force = self._analysis_pending_force
                    continue
                break

    async def close_and_persist(self) -> None:
        """Stop socket sends, flush leftover audio, and persist last detections."""
        if self._close_persist_started:
            return
        self._close_persist_started = True
        self.mark_closed()
        if self.meeting_session_repository is not None:
            self.meeting_session_repository.begin_close(self.meeting_id)
        try:
            await self.flush()
            await self._finalize_transcript_streams(close_streams=True)
            pending = list(self._background_tasks)
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
        finally:
            if self.meeting_session_repository is not None:
                self.meeting_session_repository.end_close(self.meeting_id)

    def _observe_mind_map_audio(self, *, speech: bool, duration_ms: int) -> None:
        self._mind_map_buffer = self._mind_map_buffer.observe_audio(
            speech=speech,
            duration_ms=duration_ms,
        )

    def _accumulate_mind_map_utterance(self, utterance_id: str) -> None:
        self._mind_map_buffer = self._mind_map_buffer.accumulate((utterance_id,))

    def _take_mind_map_window(self, *, include_unprocessed: bool) -> tuple[Utterance, ...]:
        self._mind_map_buffer, pending_ids = self._mind_map_buffer.take()
        known = set(pending_ids)
        window = tuple(
            item for item in self.dialogue_context.utterances if item.id in known
        )
        if include_unprocessed:
            seen = {item.id for item in window}
            extra = tuple(
                item
                for item in self.dialogue_context.utterances[
                    self._mind_map.source_utterance_count :
                ]
                if item.id not in seen
            )
            window = window + extra
        return window

    def _schedule_mind_map_flush(self, *, force: bool) -> None:
        """Send the accumulated silence window, or unprocessed text when forced."""
        if self.update_mind_map_use_case is None:
            return
        window = self._take_mind_map_window(include_unprocessed=force)
        if not window and not force:
            return
        self._schedule_mind_map(force=force, window=window)

    async def _flush_mind_map_now(self, *, force: bool) -> None:
        if self.update_mind_map_use_case is None:
            return
        window = self._take_mind_map_window(include_unprocessed=force)
        if not window and not force:
            return
        await self._trigger_mind_map(force=force, window=window)

    def _schedule_mind_map(
        self,
        force: bool,
        window: tuple[Utterance, ...] | None = None,
    ) -> None:
        """Start a mind-map update without blocking the audio loop."""
        if self.update_mind_map_use_case is None:
            return
        self._begin_persist_work()
        task = asyncio.create_task(self._run_scheduled_mind_map(force, window))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    async def _run_scheduled_mind_map(
        self,
        force: bool,
        window: tuple[Utterance, ...] | None,
    ) -> None:
        try:
            await self._trigger_mind_map(force, window=window)
        finally:
            self._end_persist_work()

    async def _trigger_mind_map(
        self,
        force: bool = False,
        window: tuple[Utterance, ...] | None = None,
    ) -> None:
        if self.update_mind_map_use_case is None:
            return
        if self._mind_map_lock.locked():
            self._mind_map_pending = True
            if force:
                self._mind_map_pending_force = True
            if window:
                self._mind_map_pending_windows.append(window)
            return

        self._begin_persist_work()
        try:
            await self._run_mind_map_loop(force, window)
        finally:
            self._end_persist_work()

    def _next_queued_mind_map_window(
        self,
        current: tuple[Utterance, ...] | None,
    ) -> tuple[Utterance, ...] | None:
        queued = list(self._mind_map_pending_windows)
        self._mind_map_pending_windows = []
        batches = ([] if current is None else [current]) + queued
        if not batches:
            return None
        merged: list[Utterance] = []
        seen: set[str] = set()
        for batch in batches:
            for utterance in batch:
                if utterance.id in seen:
                    continue
                seen.add(utterance.id)
                merged.append(utterance)
        return tuple(merged)

    async def _run_mind_map_loop(
        self,
        force: bool,
        window: tuple[Utterance, ...] | None,
    ) -> None:
        use_case = self.update_mind_map_use_case
        if use_case is None:
            return
        async with self._mind_map_lock:
            current_force = force
            current_window = window
            while True:
                self._mind_map_pending = False
                force_to_use = current_force or self._mind_map_pending_force
                self._mind_map_pending_force = False
                window_to_use = self._next_queued_mind_map_window(current_window)
                current_window = None

                try:
                    result = await use_case.execute(
                        context=self.dialogue_context,
                        current=self._mind_map,
                        force=force_to_use,
                        window=window_to_use,
                    )
                    self._mind_map = MindMapSnapshot(
                        meeting_id=result.meeting_id,
                        revision=result.revision,
                        nodes=tuple(
                            MindMapNode(
                                id=node.id,
                                label=node.label,
                                parent_id=node.parent_id,
                                source_utterance_ids=tuple(node.source_utterance_ids),
                            )
                            for node in result.nodes
                        ),
                        source_utterance_count=result.source_utterance_count,
                    )
                    self._persist_mind_map()
                    if result.changed and not self._is_closed:
                        message = MindMapMessage(
                            meeting_id=result.meeting_id,
                            revision=result.revision,
                            upserts=[
                                MindMapNodeMessage(
                                    id=node.id,
                                    label=node.label,
                                    parent_id=node.parent_id,
                                    source_utterance_ids=node.source_utterance_ids,
                                )
                                for node in result.upserts
                            ],
                            removes=result.removes,
                        )
                        await self._safe_send_text(message.model_dump_json())
                except Exception as exc:
                    logger.error("Failed to update mind map: %s", exc)

                if self._mind_map_pending or self._mind_map_pending_windows:
                    current_force = self._mind_map_pending_force
                    continue
                break

    def _persist_mind_map(self) -> None:
        if self.meeting_session_repository is None:
            return
        self.meeting_session_repository.save_mind_map(self.meeting_id, self._mind_map)

    @staticmethod
    def _align_mind_map_watermark(
        snapshot: MindMapSnapshot,
        utterance_count: int,
    ) -> MindMapSnapshot:
        """Keep the tree/revision, but never let the watermark exceed dialogue."""
        if snapshot.source_utterance_count <= utterance_count:
            return snapshot
        return MindMapSnapshot(
            meeting_id=snapshot.meeting_id,
            revision=snapshot.revision,
            nodes=snapshot.nodes,
            source_utterance_count=utterance_count,
        )

    async def send_restored_mind_map(self) -> None:
        if self._mind_map.revision <= 0 or self._is_closed:
            return
        message = MindMapMessage(
            meeting_id=self._mind_map.meeting_id,
            revision=self._mind_map.revision,
            upserts=[
                MindMapNodeMessage(
                    id=node.id,
                    label=node.label,
                    parent_id=node.parent_id,
                    source_utterance_ids=list(node.source_utterance_ids),
                )
                for node in self._mind_map.nodes
            ],
            removes=[],
        )
        await self._safe_send_text(message.model_dump_json())

    def _persist_advice(self, item: AdviceItemDTO) -> None:
        """Store a detection so finalize can include it in the requirements context."""
        if self.meeting_session_repository is None:
            return
        self.meeting_session_repository.add_advice(
            self.meeting_id,
            parse_seed_advice_item(
                category=item.category,
                title=item.title,
                reason=item.reason,
                suggested_question=item.suggested_question,
                priority=item.priority,
                quote=item.quote,
                advice_id=item.id,
            ),
        )


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
    update_mind_map_use_case: UpdateMindMapUseCase | None = Depends(
        get_update_mind_map_use_case
    ),
    meeting_session_repository: MeetingSessionRepository = Depends(
        get_meeting_session_repository
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
        update_mind_map_use_case=update_mind_map_use_case,
        meeting_session_repository=meeting_session_repository,
    )
    await session.send_restored_mind_map()

    try:
        while True:
            message = await websocket.receive()
            msg_type = message.get("type")
            if msg_type == "websocket.disconnect":
                logger.info(
                    "WebSocket disconnect event received for meeting %s", meeting_id
                )
                await session.close_and_persist()
                break

            if "bytes" in message and message["bytes"] is not None:
                await session.handle_message(message["bytes"])
            elif "text" in message and message["text"] is not None:
                await session.handle_message(message["text"])
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for meeting %s", meeting_id)
        await session.close_and_persist()
    except Exception as e:
        logger.error("Error in audio WebSocket session %s: %s", meeting_id, e)
        try:
            await session.close_and_persist()
        except Exception:
            pass
