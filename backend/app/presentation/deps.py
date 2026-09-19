"""FastAPI presentation dependencies for dependency injection."""

from app.domain.services.llm_service import LLMService
from app.infrastructure.ai.orca_router_client import OrcaRouterClient
from app.infrastructure.config import settings


def get_llm_service() -> LLMService:
    """Dependency injection provider for LLMService.

    Provides OrcaRouterClient configured via application settings.
    """
    return OrcaRouterClient(
        api_key=settings.orcarouter_api_key,
        base_url=settings.orcarouter_base_url,
        default_model=settings.orcarouter_default_model,
        timeout=settings.orcarouter_timeout_seconds,
    )
