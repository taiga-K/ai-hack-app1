"""API integration test for health and analysis routes."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.application.dto import AdviceItemDTO, AnalysisResultDTO
from app.application.use_cases import AnalyzeDialogueUseCase
from app.domain.models.analysis import AdvicePriority, IssueCategory
from app.presentation.deps import get_analyze_dialogue_use_case
from app.presentation.schemas import (
    ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH,
    ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH,
    ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS,
)
from main import app

client = TestClient(app)


def test_root_endpoint() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "AI HACK APP1 Backend API"


def test_health_check_endpoint() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data


def test_dialogue_analysis_endpoint() -> None:
    mock_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)
    advice_item = AdviceItemDTO(
        id="adv-api-1",
        category=IssueCategory.INFEASIBILITY.value,
        priority=AdvicePriority.HIGH.value,
        title="納期の実現不可能性",
        reason="残日数に対してスコープが大きすぎます。",
        suggested_question="納期の調整、または機能の絞り込みは可能でしょうか？",
        detected_at=datetime.now(UTC),
        quote="明日までに全部作ってほしい",
    )
    mock_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-rest-1",
        advice_items=[advice_item],
        analyzed_utterance_count=1,
    )

    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: mock_use_case

    try:
        payload = {
            "meeting_id": "meet-rest-1",
            "utterances": [
                "[相手クライアント] 明日までに全部作ってほしい",
            ],
        }
        response = client.post("/api/v1/analysis/dialogue", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["meeting_id"] == "meet-rest-1"
        assert len(data["advice_items"]) == 1
        item = data["advice_items"][0]
        assert item["category"] == "infeasibility"
        assert item["priority"] == "high"
        assert item["title"] == "納期の実現不可能性"
        assert "納期の調整" in item["suggested_question"]
    finally:
        app.dependency_overrides.clear()


def test_dialogue_analysis_endpoint_unexplained_jargon() -> None:
    mock_use_case = AsyncMock(spec=AnalyzeDialogueUseCase)
    advice_item = AdviceItemDTO(
        id="adv-jargon-api-1",
        category=IssueCategory.UNEXPLAINED_JARGON.value,
        priority=AdvicePriority.HIGH.value,
        title="専門用語『API』の共通認識不足",
        reason="専門用語の説明がなく、相手が曖昧な了解で聞き流しています。",
        suggested_question="『API』は、御社の既存システムからデータを取る接続口、という理解で合っていますか？",
        detected_at=datetime.now(UTC),
        quote="API連携でいけますよね / 了解です",
    )
    mock_use_case.execute.return_value = AnalysisResultDTO(
        meeting_id="meet-rest-jargon",
        advice_items=[advice_item],
        analyzed_utterance_count=2,
    )

    app.dependency_overrides[get_analyze_dialogue_use_case] = lambda: mock_use_case

    try:
        payload = {
            "meeting_id": "meet-rest-jargon",
            "utterances": [
                "[自社PM] API連携でいけますよね",
                "[相手クライアント] 了解です",
            ],
        }
        response = client.post("/api/v1/analysis/dialogue", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["advice_items"]) == 1
        item = data["advice_items"][0]
        assert item["category"] == "unexplained_jargon"
        assert "既存システムからデータを取る接続口" in item["suggested_question"]
    finally:
        app.dependency_overrides.clear()


def test_dialogue_analysis_rejects_oversized_meeting_id() -> None:
    payload = {
        "meeting_id": "m" * (ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH + 1),
        "utterances": ["短い発話"],
    }
    response = client.post("/api/v1/analysis/dialogue", json=payload)
    assert response.status_code == 422


def test_dialogue_analysis_rejects_too_many_utterances() -> None:
    payload = {
        "meeting_id": "meet-too-many",
        "utterances": ["発話"] * (ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS + 1),
    }
    response = client.post("/api/v1/analysis/dialogue", json=payload)
    assert response.status_code == 422


def test_dialogue_analysis_rejects_oversized_utterance() -> None:
    payload = {
        "meeting_id": "meet-long-utterance",
        "utterances": ["あ" * (ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH + 1)],
    }
    response = client.post("/api/v1/analysis/dialogue", json=payload)
    assert response.status_code == 422
