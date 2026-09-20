"""End-to-end meeting flow: mocked audio stream → advice → finalize → download."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.application.dto import AdviceItemDTO, AnalysisResultDTO, UtteranceDTO
from app.application.use_cases import AnalyzeDialogueUseCase, TranscribeAudioUseCase
from app.application.use_cases.generate_requirements_doc import (
    GenerateRequirementsDocUseCase,
    GetRequirementsDocUseCase,
)
from app.domain.models.analysis import AdvicePriority, IssueCategory
from app.domain.models.llm import ChatCompletionResponse
from app.domain.models.transcript import Speaker
from app.domain.services.llm_service import LLMService
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.infrastructure.persistence.in_memory_meeting_store import (
    InMemoryMeetingSessionStore,
)
from app.presentation.deps import (
    get_analyze_dialogue_use_case,
    get_channel_diarizer,
    get_generate_requirements_doc_use_case,
    get_meeting_session_repository,
    get_requirements_doc_use_case,
    get_transcribe_audio_use_case,
    get_update_mind_map_use_case,
)
from main import app


def bind_stream_to_execute(mock_use_case: AsyncMock) -> AsyncMock:
    def open_stream(
        speaker: Speaker,
        meeting_id: str,
        start_offset_ms: int = 0,
    ) -> object:
        class _Stream:
            async def append(self, audio_chunk: object) -> object:
                return await mock_use_case.execute(audio_chunk, meeting_id)

            async def commit(self) -> list[object]:
                return []

            async def close(self) -> list[object]:
                return []

        return _Stream()

    mock_use_case.open_stream.side_effect = open_stream
    return mock_use_case


MEETING_ID = "e2e-meet-flow-1"


def _requirements_llm_payload() -> dict[str, str]:
    return {
        "title": "E2E要件定義書",
        "overview": "擬似音声ストリームから生成した初回ヒアリングです。",
        "scope": "- 対象: 既存顧客向け更新申請\n- 対象外: 未確認",
        "business_flow": "1. 申請 2. 取り込み 3. 確認",
        "functional": "- 優先度High: 更新申請の取り込み",
        "non_functional": "- 希望納期: 来月末",
        "open_issues": "- 『API連携』の意味を平易な言葉で再確認する",
        "changelog": "- 自社PMと相手の発話を集約",
    }


def _override_meeting_flow(
    store: InMemoryMeetingSessionStore,
    transcribe: TranscribeAudioUseCase,
    analyze: AnalyzeDialogueUseCase,
    generate: GenerateRequirementsDocUseCase,
) -> None:
    app.dependency_overrides[get_meeting_session_repository] = lambda: store
    app.dependency_overrides[get_transcribe_audio_use_case] = lambda: transcribe
    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: analyze
    app.dependency_overrides[get_update_mind_map_use_case] = lambda: None
    app.dependency_overrides[get_channel_diarizer] = lambda: ChannelDiarizer(
        sample_rate=16000
    )
    app.dependency_overrides[get_generate_requirements_doc_use_case] = lambda: generate
    app.dependency_overrides[get_requirements_doc_use_case] = lambda: (
        GetRequirementsDocUseCase(meeting_session_repository=store)
    )


@pytest.mark.asyncio
async def test_e2e_audio_advice_finalize_and_download() -> None:
    store = InMemoryMeetingSessionStore()
    mock_transcribe = bind_stream_to_execute(AsyncMock(spec=TranscribeAudioUseCase))
    mock_analyze = AsyncMock(spec=AnalyzeDialogueUseCase)
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(_requirements_llm_payload()),
        model="anthropic/claude-3-5-sonnet",
    )

    async def mock_execute(chunk, meeting_id):  # type: ignore[no-untyped-def]
        if chunk.speaker == Speaker.LOCAL_PM:
            return [
                UtteranceDTO(
                    id="e2e-utt-pm",
                    meeting_id=meeting_id,
                    speaker="local_pm",
                    text="対象範囲は既存顧客向けの更新申請だけと考えてよいですか？",
                    start_ms=chunk.timestamp_ms,
                    end_ms=chunk.timestamp_ms + 1000,
                    is_final=True,
                    created_at=datetime.now(UTC),
                )
            ]
        return [
            UtteranceDTO(
                id="e2e-utt-cli",
                meeting_id=meeting_id,
                speaker="remote_client",
                text="はい。API連携で来月末までに本番投入したいです。",
                start_ms=chunk.timestamp_ms,
                end_ms=chunk.timestamp_ms + 900,
                is_final=True,
                created_at=datetime.now(UTC),
            )
        ]

    mock_transcribe.execute.side_effect = mock_execute
    mock_analyze.execute.return_value = AnalysisResultDTO(
        meeting_id=MEETING_ID,
        advice_items=[
            AdviceItemDTO(
                id="e2e-adv-jargon",
                category=IssueCategory.UNEXPLAINED_JARGON.value,
                priority=AdvicePriority.HIGH.value,
                title="専門用語『API連携』の共通認識不足",
                reason="説明のない専門用語に対して曖昧な相づちのみ",
                suggested_question="『API連携』は画面参照だけですか、書き込みも含みますか？",
                detected_at=datetime.now(UTC),
                quote="API連携で来月末までに本番投入したいです",
            )
        ],
        analyzed_utterance_count=2,
    )
    generate = GenerateRequirementsDocUseCase(
        llm_service=mock_llm,
        meeting_session_repository=store,
    )
    _override_meeting_flow(store, mock_transcribe, mock_analyze, generate)

    try:
        client = TestClient(app)
        with client.websocket_connect(f"/ws/meetings/{MEETING_ID}/audio") as ws:
            stereo_bytes = np.zeros(64000, dtype=np.int16).tobytes()
            ws.send_bytes(stereo_bytes)

            messages = [ws.receive_json(), ws.receive_json(), ws.receive_json()]
            types = {message["type"] for message in messages}
            assert types == {"utterance", "advice"}
            speakers = {
                message["speaker"]
                for message in messages
                if message["type"] == "utterance"
            }
            assert speakers == {"local_pm", "remote_client"}
            advice = next(
                message for message in messages if message["type"] == "advice"
            )
            assert advice["category"] == "unexplained_jargon"
            assert "API連携" in advice["suggested_question"]

        persisted = store.get(MEETING_ID)
        assert persisted is not None
        assert persisted.dialogue.total_utterances == 2
        assert persisted.advice_items[0].category == IssueCategory.UNEXPLAINED_JARGON

        finalize = client.post(
            f"/api/v1/meetings/{MEETING_ID}/finalize",
            json={"title": "E2Eヒアリング", "utterances": [], "advice_items": []},
        )
        assert finalize.status_code == 200
        body = finalize.json()
        assert body["meeting_id"] == MEETING_ID
        assert body["source_utterance_count"] == 2
        assert body["source_detection_count"] == 1
        assert "## 1. プロジェクト/会議概要・背景・ゴール" in body["markdown"]
        assert "API連携" in body["markdown"]
        mock_llm.chat_completion.assert_awaited_once()

        fetched = client.get(f"/api/v1/meetings/{MEETING_ID}/requirements")
        assert fetched.status_code == 200
        assert fetched.json()["id"] == body["id"]

        download = client.get(f"/api/v1/meetings/{MEETING_ID}/requirements/download")
        assert download.status_code == 200
        assert download.headers["content-type"].startswith("text/markdown")
        assert (
            f"requirements-{MEETING_ID}.md" in download.headers["content-disposition"]
        )
        assert download.text == body["markdown"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_e2e_finalize_without_transcript_returns_400() -> None:
    store = InMemoryMeetingSessionStore()
    mock_llm = AsyncMock(spec=LLMService)
    generate = GenerateRequirementsDocUseCase(
        llm_service=mock_llm,
        meeting_session_repository=store,
    )
    _override_meeting_flow(
        store,
        AsyncMock(spec=TranscribeAudioUseCase),
        AsyncMock(spec=AnalyzeDialogueUseCase),
        generate,
    )

    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/meetings/e2e-empty/finalize",
            json={"title": "空会議", "utterances": [], "advice_items": []},
        )
        assert response.status_code == 400
        mock_llm.chat_completion.assert_not_awaited()
    finally:
        app.dependency_overrides.clear()
