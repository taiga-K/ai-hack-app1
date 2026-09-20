"""Tests for WebSocket audio streaming endpoint."""

import asyncio
import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.application.dto import (
    AdviceItemDTO,
    AnalysisResultDTO,
    MindMapNodeDTO,
    MindMapUpdateDTO,
    UtteranceDTO,
)
from app.application.use_cases import (
    AnalyzeDialogueUseCase,
    TranscribeAudioUseCase,
    UpdateMindMapUseCase,
)
from app.domain.exceptions import STTServiceError
from app.domain.models.analysis import AdvicePriority, IssueCategory
from app.domain.models.transcript import Speaker, Utterance
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.infrastructure.persistence.in_memory_meeting_store import (
    InMemoryMeetingSessionStore,
)
from app.presentation.api.v1.websocket import AudioStreamSession
from app.presentation.deps import (
    get_analyze_dialogue_use_case,
    get_channel_diarizer,
    get_meeting_session_repository,
    get_transcribe_audio_use_case,
    get_update_mind_map_use_case,
)
from main import app


@pytest.mark.asyncio
async def test_websocket_ping_pong() -> None:
    client = TestClient(app)
    with client.websocket_connect("/ws/meetings/meet-1/audio") as ws:
        ws.send_text(json.dumps({"action": "ping"}))
        response = ws.receive_json()
        assert response == {"type": "pong"}


@pytest.mark.asyncio
async def test_websocket_audio_streaming() -> None:
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_analyze_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)
    mock_analyze_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-test",
        advice_items=[],
        analyzed_utterance_count=0,
    )

    async def mock_execute(chunk, meeting_id):  # type: ignore[no-untyped-def]
        if chunk.speaker == Speaker.LOCAL_PM:
            return [
                UtteranceDTO(
                    id="utt-pm-1",
                    meeting_id=meeting_id,
                    speaker="local_pm",
                    text="本日の議題を確認します。",
                    start_ms=chunk.timestamp_ms,
                    end_ms=chunk.timestamp_ms + 1000,
                    is_final=True,
                    created_at=datetime.now(UTC),
                )
            ]
        return [
            UtteranceDTO(
                id="utt-cli-1",
                meeting_id=meeting_id,
                speaker="remote_client",
                text="よろしくお願いします。",
                start_ms=chunk.timestamp_ms,
                end_ms=chunk.timestamp_ms + 1000,
                is_final=True,
                created_at=datetime.now(UTC),
            )
        ]

    mock_use_case.execute.side_effect = mock_execute

    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: (
        mock_analyze_use_case
    )
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-test/audio") as ws:
            stereo_bytes = np.zeros(64000, dtype=np.int16).tobytes()
            ws.send_bytes(stereo_bytes)

            msg1 = ws.receive_json()
            msg2 = ws.receive_json()

            speakers = {msg1["speaker"], msg2["speaker"]}
            assert speakers == {"local_pm", "remote_client"}
            assert msg1["meeting_id"] == "meet-test"
            assert msg2["meeting_id"] == "meet-test"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_websocket_advice_broadcast_on_manual_analyze() -> None:
    """Verify manual analyze action via WebSocket triggers analysis and broadcasts advice."""
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_analyze_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)

    advice_item = AdviceItemDTO(
        id="adv-ws-1",
        category=IssueCategory.AMBIGUITY.value,
        priority=AdvicePriority.HIGH.value,
        title="要件の曖昧性",
        reason="具体的な数値要件が不足しています。",
        suggested_question="想定される同時接続ユーザー数はどれくらいでしょうか？",
        detected_at=datetime.now(UTC),
        quote="アクセスがかなり多い想定です",
    )
    mock_analyze_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-adv",
        advice_items=[advice_item],
        analyzed_utterance_count=1,
    )

    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: (
        mock_analyze_use_case
    )
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-adv/audio") as ws:
            ws.send_text(json.dumps({"action": "analyze"}))

            msg = ws.receive_json()
            assert msg["type"] == "advice"
            assert msg["category"] == "ambiguity"
            assert msg["title"] == "要件の曖昧性"
            assert "同時接続ユーザー数" in msg["suggested_question"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_websocket_advice_deduplication() -> None:
    """Verify duplicate advice items with same ID are not rebroadcast."""
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_analyze_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)

    advice_item = AdviceItemDTO(
        id="stable-adv-id-1",
        category=IssueCategory.AMBIGUITY.value,
        priority=AdvicePriority.HIGH.value,
        title="UIの曖昧性",
        reason="具体化不足",
        suggested_question="画面遷移はどうなりますか？",
        detected_at=datetime.now(UTC),
        quote="UIをいい感じに",
    )
    # Return same advice item twice
    mock_analyze_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-dedupe",
        advice_items=[advice_item],
        analyzed_utterance_count=1,
    )

    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: (
        mock_analyze_use_case
    )
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-dedupe/audio") as ws:
            # First trigger -> receives advice
            ws.send_text(json.dumps({"action": "analyze"}))
            msg = ws.receive_json()
            assert msg["type"] == "advice"
            assert msg["id"] == "stable-adv-id-1"

            # Ping to verify socket remains healthy
            ws.send_text(json.dumps({"action": "ping"}))
            pong = ws.receive_json()
            assert pong == {"type": "pong"}

            # Second trigger with same advice ID -> should be deduplicated and not sent
            ws.send_text(json.dumps({"action": "analyze"}))
            ws.send_text(json.dumps({"action": "ping"}))
            # Next message must be pong, not duplicated advice
            next_msg = ws.receive_json()
            assert next_msg == {"type": "pong"}
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_websocket_skips_audio_chunk_on_processing_error() -> None:
    """Verify STTServiceError or AudioProcessingError does not crash WebSocket."""
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_use_case.execute.side_effect = STTServiceError("Whisper transient failure")

    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-stt-err/audio") as ws:
            stereo_bytes = np.zeros(64000, dtype=np.int16).tobytes()
            ws.send_bytes(stereo_bytes)

            # WebSocket should remain open and respond to ping
            ws.send_text(json.dumps({"action": "ping"}))
            res = ws.receive_json()
            assert res == {"type": "pong"}
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_websocket_manual_analyze_is_non_blocking_during_in_flight_llm() -> None:
    """Verify manual analyze triggers analysis in background without blocking receive loop."""
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_analyze_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)

    # Simulate an in-flight LLM call that takes some time or waits for an event
    llm_started = asyncio.Event()
    continue_llm = asyncio.Event()

    async def slow_execute(context, force_analyze):  # type: ignore[no-untyped-def]
        llm_started.set()
        await continue_llm.wait()
        return AnalysisResultDTO(
            meeting_id=context.meeting_id,
            advice_items=[
                AdviceItemDTO(
                    id="adv-async-1",
                    category=IssueCategory.UNEXPLAINED_JARGON.value,
                    priority=AdvicePriority.HIGH.value,
                    title="専門用語の確認",
                    reason="専門用語の確認不足",
                    suggested_question="用語の意味の確認です",
                    detected_at=datetime.now(UTC),
                    quote="API",
                )
            ],
            analyzed_utterance_count=1,
        )

    mock_analyze_use_case.execute.side_effect = slow_execute

    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: (
        mock_analyze_use_case
    )
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-nonblocking/audio") as ws:
            # Send analyze action
            ws.send_text(json.dumps({"action": "analyze"}))

            # Ping should immediately succeed even while LLM call is in-flight
            ws.send_text(json.dumps({"action": "ping"}))
            pong_msg = ws.receive_json()
            assert pong_msg == {"type": "pong"}

            # Let LLM complete and verify advice is received
            continue_llm.set()
            advice_msg = ws.receive_json()
            assert advice_msg["type"] == "advice"
            assert advice_msg["id"] == "adv-async-1"
    finally:
        continue_llm.set()
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_websocket_disconnect_flushes_safely_without_send_error() -> None:
    store = InMemoryMeetingSessionStore()
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_analyze_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)

    async def mock_execute(chunk, meeting_id):  # type: ignore[no-untyped-def]
        speaker = "local_pm" if chunk.speaker == Speaker.LOCAL_PM else "remote_client"
        return [
            UtteranceDTO(
                id=f"utt-flush-{speaker}",
                meeting_id=meeting_id,
                speaker=speaker,
                text="切断前の最後の発話です。",
                start_ms=chunk.timestamp_ms,
                end_ms=chunk.timestamp_ms + 500,
                is_final=True,
                created_at=datetime.now(UTC),
            )
        ]

    mock_use_case.execute.side_effect = mock_execute
    mock_analyze_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-disconnect",
        advice_items=[
            AdviceItemDTO(
                id="adv-flush-last",
                category=IssueCategory.UNEXPLAINED_JARGON.value,
                priority=AdvicePriority.HIGH.value,
                title="切断直前の専門用語",
                reason="末尾発話の確認が残っている",
                suggested_question="最後の用語の意味は合っていますか？",
                detected_at=datetime.now(UTC),
                quote="切断前の最後の発話です。",
            )
        ],
        analyzed_utterance_count=2,
    )
    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: (
        mock_analyze_use_case
    )
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )
    app.dependency_overrides[get_meeting_session_repository] = lambda: store

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-disconnect/audio") as ws:
            # Send less than full buffer to leave data in _buffer
            short_stereo = np.zeros(16000, dtype=np.int16).tobytes()
            ws.send_bytes(short_stereo)
            # Closing the connection triggers disconnect path
            ws.close()

        record = store.get("meet-disconnect")
        assert record is not None
        assert record.dialogue.total_utterances == 2
        assert {u.speaker.value for u in record.dialogue.utterances} == {
            "local_pm",
            "remote_client",
        }
        assert len(record.advice_items) == 1
        assert record.advice_items[0].id == "adv-flush-last"
        assert record.advice_items[0].category == IssueCategory.UNEXPLAINED_JARGON
        mock_analyze_use_case.execute.assert_awaited()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_websocket_persists_utterances_and_unexplained_jargon_for_finalize() -> (
    None
):
    """Verify live session detections are stored for requirements generation."""
    store = InMemoryMeetingSessionStore()
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_analyze_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)

    async def mock_execute(chunk, meeting_id):  # type: ignore[no-untyped-def]
        if chunk.speaker == Speaker.LOCAL_PM:
            return [
                UtteranceDTO(
                    id="utt-persist-pm",
                    meeting_id=meeting_id,
                    speaker="local_pm",
                    text="基幹側のデータはAPIで取れますよね。",
                    start_ms=chunk.timestamp_ms,
                    end_ms=chunk.timestamp_ms + 1000,
                    is_final=True,
                    created_at=datetime.now(UTC),
                )
            ]
        return [
            UtteranceDTO(
                id="utt-persist-cli",
                meeting_id=meeting_id,
                speaker="remote_client",
                text="はい、わかりました。",
                start_ms=chunk.timestamp_ms,
                end_ms=chunk.timestamp_ms + 800,
                is_final=True,
                created_at=datetime.now(UTC),
            )
        ]

    mock_use_case.execute.side_effect = mock_execute
    mock_analyze_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-persist",
        advice_items=[
            AdviceItemDTO(
                id="adv-persist-jargon",
                category=IssueCategory.UNEXPLAINED_JARGON.value,
                priority=AdvicePriority.HIGH.value,
                title="専門用語『API』の共通認識不足",
                reason="曖昧な相づちのみ",
                suggested_question="接続口という意味で合っていますか？",
                detected_at=datetime.now(UTC),
                quote="APIで取れますよね / はい、わかりました",
            )
        ],
        analyzed_utterance_count=2,
    )

    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: (
        mock_analyze_use_case
    )
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )
    app.dependency_overrides[get_meeting_session_repository] = lambda: store

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-persist/audio") as ws:
            stereo_bytes = np.zeros(64000, dtype=np.int16).tobytes()
            ws.send_bytes(stereo_bytes)
            ws.receive_json()
            ws.receive_json()
            advice = ws.receive_json()
            assert advice["type"] == "advice"
            assert advice["category"] == "unexplained_jargon"

        record = store.get("meet-persist")
        assert record is not None
        assert record.dialogue.total_utterances == 2
        assert len(record.advice_items) == 1
        assert record.advice_items[0].category == IssueCategory.UNEXPLAINED_JARGON
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_websocket_mindmap_broadcast_on_manual_analyze() -> None:
    mock_use_case = AsyncMock(spec=TranscribeAudioUseCase)
    mock_analyze_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)
    mock_analyze_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-map",
        advice_items=[],
        analyzed_utterance_count=0,
    )
    mock_mind_map = AsyncMock(spec=UpdateMindMapUseCase)
    mock_mind_map.execute.return_value = MindMapUpdateDTO(
        meeting_id="meet-map",
        revision=1,
        upserts=[
            MindMapNodeDTO(
                id="root",
                label="今日の会議",
                parent_id=None,
                source_utterance_ids=[],
            )
        ],
        removes=[],
        nodes=[
            MindMapNodeDTO(
                id="root",
                label="今日の会議",
                parent_id=None,
                source_utterance_ids=[],
            )
        ],
        source_utterance_count=1,
        changed=True,
    )

    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: mock_use_case
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: (
        mock_analyze_use_case
    )
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: mock_mind_map
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )

    try:
        client = TestClient(app)
        with client.websocket_connect("/ws/meetings/meet-map/audio") as ws:
            ws.send_text(json.dumps({"action": "analyze"}))
            messages = [ws.receive_json()]
            if messages[0]["type"] != "mindmap":
                messages.append(ws.receive_json())
            mindmap = next(item for item in messages if item["type"] == "mindmap")
            assert mindmap["revision"] == 1
            assert mindmap["upserts"][0]["label"] == "今日の会議"
            mock_mind_map.execute.assert_awaited()
    finally:
        app.dependency_overrides.clear()


def _session_utterance(meeting_id: str, utterance_id: str, text: str) -> Utterance:
    return Utterance(
        id=utterance_id,
        meeting_id=meeting_id,
        speaker=Speaker.REMOTE_CLIENT,
        text=text,
        start_ms=0,
        end_ms=1000,
        is_final=True,
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_session_empty_mindmap_delta_persists_watermark() -> None:
    mock_mind_map = AsyncMock(spec=UpdateMindMapUseCase)
    mock_mind_map.execute.return_value = MindMapUpdateDTO(
        meeting_id="meet-map-empty",
        revision=1,
        upserts=[],
        removes=[],
        nodes=[
            MindMapNodeDTO(
                id="root",
                label="今日の会議",
                parent_id=None,
                source_utterance_ids=[],
            )
        ],
        source_utterance_count=2,
        changed=False,
    )
    websocket = AsyncMock()
    session = AudioStreamSession(
        meeting_id="meet-map-empty",
        websocket=websocket,
        diarizer=ChannelDiarizer(sample_rate=16000),
        transcribe_use_case=AsyncMock(spec=TranscribeAudioUseCase),
        update_mind_map_use_case=mock_mind_map,
    )
    session.dialogue_context.add_utterance(
        _session_utterance("meet-map-empty", "u-1", "了解です。そこはお任せします。")
    )
    session.dialogue_context.add_utterance(
        _session_utterance("meet-map-empty", "u-2", "現場も同じ認識です。")
    )

    await session._trigger_mind_map(force=True)

    assert session._mind_map.source_utterance_count == 2
    assert session._mind_map.revision == 1
    websocket.send_text.assert_not_awaited()
    first_current = mock_mind_map.execute.await_args_list[0].kwargs["current"]
    assert first_current.source_utterance_count == 0

    await session._trigger_mind_map(force=True)

    assert mock_mind_map.execute.await_count == 2
    second_current = mock_mind_map.execute.await_args_list[1].kwargs["current"]
    assert second_current.source_utterance_count == 2
    websocket.send_text.assert_not_awaited()
