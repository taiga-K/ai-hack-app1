"""Integration tests for presentation DI wiring."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.application.use_cases import (
    AnalyzeDialogueUseCase,
    GenerateRequirementsDocUseCase,
    GetRequirementsDocUseCase,
    TranscribeAudioUseCase,
    UpdateMindMapUseCase,
)
from app.domain.exceptions import STTConfigurationError
from app.domain.models.transcript import Speaker
from app.domain.services.llm_service import LLMService
from app.domain.services.meeting_session_repository import MeetingSessionRepository
from app.domain.services.stt_service import STTService
from app.infrastructure.ai.orca_router_client import OrcaRouterClient
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.infrastructure.persistence.in_memory_meeting_store import (
    InMemoryMeetingSessionStore,
)
from app.infrastructure.stt.openai_realtime import OpenAIRealtimeWhisperSTTService
from app.presentation.deps import (
    get_analyze_dialogue_use_case,
    get_channel_diarizer,
    get_generate_requirements_doc_use_case,
    get_llm_service,
    get_meeting_session_repository,
    get_requirements_doc_use_case,
    get_stt_service,
    get_transcribe_audio_use_case,
    get_update_mind_map_use_case,
)


def test_get_llm_service_dependency_injection(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify FastAPI Depends resolves get_llm_service and returns LLMService."""
    monkeypatch.setattr("app.presentation.deps.settings.orcarouter_api_key", "test-key")
    monkeypatch.setattr(
        "app.presentation.deps.settings.orcarouter_default_model",
        "custom/test-model",
    )

    test_app = FastAPI()

    @test_app.get("/test-llm")
    def sample_endpoint(
        service: LLMService = Depends(get_llm_service),
    ) -> dict[str, str]:
        assert isinstance(service, OrcaRouterClient)
        assert isinstance(service, LLMService)
        assert service._default_model == "custom/test-model"
        return {"status": "ok"}

    client = TestClient(test_app)
    response = client.get("/test-llm")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_stt_and_diarizer_dependency_injection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify STT and Diarizer dependency injection."""
    monkeypatch.setattr("app.presentation.deps._stt_service_instance", None)
    monkeypatch.setattr("app.presentation.deps.settings.stt_provider", "openai")
    monkeypatch.setattr("app.presentation.deps.settings.openai_api_key", "sk-test")
    test_app = FastAPI()

    @test_app.get("/test-stt-diarizer")
    def sample_stt_endpoint(
        stt: STTService = Depends(get_stt_service),
        diarizer: ChannelDiarizer = Depends(get_channel_diarizer),
        use_case: TranscribeAudioUseCase = Depends(get_transcribe_audio_use_case),
    ) -> dict[str, str]:
        assert isinstance(stt, OpenAIRealtimeWhisperSTTService)
        assert isinstance(stt, STTService)
        assert isinstance(diarizer, ChannelDiarizer)
        assert isinstance(use_case, TranscribeAudioUseCase)
        return {"status": "ok"}

    client = TestClient(test_app)
    response = client.get("/test-stt-diarizer")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_stt_service_azure_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.presentation.deps._stt_service_instance", None)
    monkeypatch.setattr("app.presentation.deps.settings.stt_provider", "azure")
    monkeypatch.setattr("app.presentation.deps.settings.openai_api_key", "sk-test")
    with pytest.raises(STTConfigurationError, match="STT_PROVIDER=azure"):
        get_stt_service()


@pytest.mark.asyncio
async def test_get_stt_service_missing_openai_key_fails_closed_on_transcribe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.presentation.deps._stt_service_instance", None)
    monkeypatch.setattr("app.presentation.deps.settings.stt_provider", "openai")
    monkeypatch.setattr("app.presentation.deps.settings.openai_api_key", "")
    service = get_stt_service()
    with pytest.raises(STTConfigurationError, match="OPENAI_API_KEY"):
        await service.transcribe(
            audio_data=b"\x00\x00\x01\x00",
            sample_rate=16000,
            speaker=Speaker.LOCAL_PM,
            meeting_id="meeting-1",
        )


def test_get_analyze_dialogue_use_case_dependency_injection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify AnalyzeDialogueUseCase dependency injection when key is configured."""
    monkeypatch.setattr("app.presentation.deps.settings.orcarouter_api_key", "test-key")
    test_app = FastAPI()

    @test_app.get("/test-analyze-di")
    def sample_analyze_endpoint(
        use_case: AnalyzeDialogueUseCase | None = Depends(
            get_analyze_dialogue_use_case
        ),
    ) -> dict[str, str]:
        assert isinstance(use_case, AnalyzeDialogueUseCase)
        assert isinstance(use_case._llm_service, OrcaRouterClient)
        return {"status": "ok"}

    client = TestClient(test_app)
    response = client.get("/test-analyze-di")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_analyze_dialogue_use_case_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify AnalyzeDialogueUseCase returns None when key is empty."""
    monkeypatch.setattr("app.presentation.deps.settings.orcarouter_api_key", "")
    test_app = FastAPI()

    @test_app.get("/test-analyze-none")
    def sample_analyze_endpoint(
        use_case: AnalyzeDialogueUseCase | None = Depends(
            get_analyze_dialogue_use_case
        ),
    ) -> dict[str, str]:
        assert use_case is None
        return {"status": "none"}

    client = TestClient(test_app)
    response = client.get("/test-analyze-none")
    assert response.status_code == 200
    assert response.json() == {"status": "none"}


def test_get_update_mind_map_use_case_dependency_injection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.presentation.deps.settings.orcarouter_api_key", "test-key")
    test_app = FastAPI()

    @test_app.get("/test-mind-map-di")
    def sample_mind_map_endpoint(
        use_case: UpdateMindMapUseCase | None = Depends(get_update_mind_map_use_case),
    ) -> dict[str, str]:
        assert isinstance(use_case, UpdateMindMapUseCase)
        assert isinstance(use_case._llm_service, OrcaRouterClient)
        return {"status": "ok"}

    client = TestClient(test_app)
    response = client.get("/test-mind-map-di")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_generate_requirements_doc_use_case_dependency_injection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.presentation.deps.settings.orcarouter_api_key", "test-key")
    monkeypatch.setattr(
        "app.presentation.deps.settings.orcarouter_requirements_model",
        "deepseek/deepseek-v4-flash-free",
    )
    test_app = FastAPI()

    @test_app.get("/test-req-di")
    def sample_requirements_endpoint(
        use_case: GenerateRequirementsDocUseCase | None = Depends(
            get_generate_requirements_doc_use_case
        ),
        getter: GetRequirementsDocUseCase = Depends(get_requirements_doc_use_case),
        store: MeetingSessionRepository = Depends(get_meeting_session_repository),
    ) -> dict[str, str]:
        assert isinstance(use_case, GenerateRequirementsDocUseCase)
        assert isinstance(use_case._llm_service, OrcaRouterClient)
        assert use_case._model == "deepseek/deepseek-v4-flash-free"
        assert isinstance(getter, GetRequirementsDocUseCase)
        assert isinstance(store, InMemoryMeetingSessionStore)
        return {"status": "ok"}

    client = TestClient(test_app)
    response = client.get("/test-req-di")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
