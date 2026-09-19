"""Integration tests for Orca Router presentation DI wiring."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.domain.services.llm_service import LLMService
from app.infrastructure.ai.orca_router_client import OrcaRouterClient
from app.presentation.deps import get_llm_service


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
