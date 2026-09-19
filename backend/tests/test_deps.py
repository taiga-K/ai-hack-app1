"""Integration tests for Orca Router presentation DI wiring."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.application.use_cases import TranscribeAudioUseCase
from app.domain.services.llm_service import LLMService
from app.domain.services.stt_service import STTService
from app.infrastructure.ai.orca_router_client import OrcaRouterClient
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.infrastructure.stt.whisper_stt import FasterWhisperSTTService
from app.presentation.deps import (
    get_channel_diarizer,
    get_llm_service,
    get_stt_service,
    get_transcribe_audio_use_case,
)


def test_get_llm_service_dependency_injection(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify FastAPI Depends resolves get_llm_service and returns LLMService."""
    monkeypatch.setattr("app.presentation.deps.settings.orcarouter_api_key", "test-key")

    test_app = FastAPI()

    @test_app.get("/test-llm")
    def sample_endpoint(
        service: LLMService = Depends(get_llm_service),
    ) -> dict[str, str]:
        assert isinstance(service, OrcaRouterClient)
        assert isinstance(service, LLMService)
        return {"status": "ok"}

    client = TestClient(test_app)
    response = client.get("/test-llm")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_stt_and_diarizer_dependency_injection() -> None:
    """Verify STT and Diarizer dependency injection."""
    test_app = FastAPI()

    @test_app.get("/test-stt-diarizer")
    def sample_stt_endpoint(
        stt: STTService = Depends(get_stt_service),
        diarizer: ChannelDiarizer = Depends(get_channel_diarizer),
        use_case: TranscribeAudioUseCase = Depends(get_transcribe_audio_use_case),
    ) -> dict[str, str]:
        assert isinstance(stt, FasterWhisperSTTService)
        assert isinstance(stt, STTService)
        assert isinstance(diarizer, ChannelDiarizer)
        assert isinstance(use_case, TranscribeAudioUseCase)
        return {"status": "ok"}

    client = TestClient(test_app)
    response = client.get("/test-stt-diarizer")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
