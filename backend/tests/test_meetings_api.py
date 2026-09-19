"""API tests for meeting finalize and requirements document endpoints."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.application.dto import RequirementsDocumentDTO, RequirementsSectionDTO
from app.application.use_cases.generate_requirements_doc import (
    GenerateRequirementsDocUseCase,
)
from app.domain.exceptions import (
    MeetingHasNoTranscriptError,
    RequirementsDocNotFoundError,
)
from app.presentation.deps import (
    get_generate_requirements_doc_use_case,
    get_requirements_doc_use_case,
)
from main import app

client = TestClient(app)


def _document_dto(meeting_id: str = "meet-final-1") -> RequirementsDocumentDTO:
    return RequirementsDocumentDTO(
        id="doc-1",
        meeting_id=meeting_id,
        title="要件定義書",
        markdown=(
            "# 要件定義書\n\n## 1. プロジェクト/会議概要・背景・ゴール\n\n概要\n"
        ),
        sections=[
            RequirementsSectionDTO(
                section_id="overview",
                heading="1. プロジェクト/会議概要・背景・ゴール",
                body_markdown="概要",
            )
        ],
        created_at=datetime.now(UTC),
        model="anthropic/claude-3-5-sonnet",
        source_utterance_count=2,
        source_detection_count=1,
    )


def test_finalize_meeting_endpoint() -> None:
    mock_use_case = AsyncMock(spec=GenerateRequirementsDocUseCase)
    mock_use_case.execute.return_value = _document_dto()
    app.dependency_overrides[get_generate_requirements_doc_use_case] = lambda: (
        mock_use_case
    )
    try:
        response = client.post(
            "/api/v1/meetings/meet-final-1/finalize",
            json={
                "title": "初回ヒアリング",
                "utterances": [
                    "[自社PM] API連携でいけますよね",
                    "[相手クライアント] 了解です",
                ],
                "advice_items": [
                    {
                        "category": "unexplained_jargon",
                        "priority": "high",
                        "title": "専門用語『API』の共通認識不足",
                        "reason": "曖昧な了解のみ",
                        "suggested_question": "接続口という意味で合っていますか？",
                        "quote": "API連携でいけますよね / 了解です",
                    }
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["meeting_id"] == "meet-final-1"
        assert data["source_utterance_count"] == 2
        assert data["source_detection_count"] == 1
        mock_use_case.execute.assert_awaited_once()
        kwargs = mock_use_case.execute.await_args.kwargs
        assert kwargs["meeting_id"] == "meet-final-1"
        assert len(kwargs["extra_utterances"]) == 2
        assert kwargs["extra_advice_items"][0].category.value == "unexplained_jargon"
    finally:
        app.dependency_overrides.clear()


def test_finalize_meeting_without_transcript_returns_400() -> None:
    mock_use_case = AsyncMock(spec=GenerateRequirementsDocUseCase)
    mock_use_case.execute.side_effect = MeetingHasNoTranscriptError("no utterances")
    app.dependency_overrides[get_generate_requirements_doc_use_case] = lambda: (
        mock_use_case
    )
    try:
        response = client.post("/api/v1/meetings/meet-empty/finalize", json={})
        assert response.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_finalize_meeting_unconfigured_returns_503() -> None:
    app.dependency_overrides[get_generate_requirements_doc_use_case] = lambda: None
    try:
        response = client.post("/api/v1/meetings/meet-no-llm/finalize", json={})
        assert response.status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_get_and_download_requirements_document() -> None:
    class StubGetUseCase:
        def execute(self, meeting_id: str) -> RequirementsDocumentDTO:
            return _document_dto(meeting_id)

    app.dependency_overrides[get_requirements_doc_use_case] = lambda: StubGetUseCase()
    try:
        get_response = client.get("/api/v1/meetings/meet-final-1/requirements")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == "doc-1"

        download = client.get("/api/v1/meetings/meet-final-1/requirements/download")
        assert download.status_code == 200
        assert download.headers["content-type"].startswith("text/markdown")
        assert "requirements-meet-final-1.md" in download.headers["content-disposition"]
        assert download.text.startswith("# 要件定義書")
    finally:
        app.dependency_overrides.clear()


def test_get_requirements_document_not_found() -> None:
    class MissingDocUseCase:
        def execute(self, meeting_id: str) -> RequirementsDocumentDTO:
            raise RequirementsDocNotFoundError(f"missing {meeting_id}")

    app.dependency_overrides[get_requirements_doc_use_case] = lambda: (
        MissingDocUseCase()
    )
    try:
        response = client.get("/api/v1/meetings/unknown/requirements")
        assert response.status_code == 404
        download = client.get("/api/v1/meetings/unknown/requirements/download")
        assert download.status_code == 404
    finally:
        app.dependency_overrides.clear()
