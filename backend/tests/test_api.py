"""API integration test for health and analysis routes."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.application.dto import AdviceItemDTO, AnalysisResultDTO
from app.application.use_cases import AnalyzeDialogueUseCase
from app.domain.models.analysis import AdvicePriority, IssueCategory
from app.presentation.deps import get_analyze_dialogue_use_case
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
