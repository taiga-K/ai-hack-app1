"""Tests for WebSocket audio streaming endpoint."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.application.dto import AdviceItemDTO, AnalysisResultDTO, UtteranceDTO
from app.application.use_cases import AnalyzeDialogueUseCase, TranscribeAudioUseCase
from app.domain.models.analysis import AdvicePriority, IssueCategory
from app.domain.models.transcript import Speaker
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.presentation.deps import (
    get_analyze_dialogue_use_case,
    get_channel_diarizer,
    get_transcribe_audio_use_case,
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
