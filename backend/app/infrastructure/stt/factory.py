"""Compose an STTService from settings. Provider names stay out of use cases."""

from app.domain.exceptions import STTConfigurationError
from app.domain.services.stt_service import STTService
from app.infrastructure.config import Settings
from app.infrastructure.stt.openai_realtime import (
    OPENAI_STT_DELAYS,
    OpenAIRealtimeWhisperSTTService,
)

IMPLEMENTED_STT_PROVIDERS = frozenset({"openai"})


def build_stt_service(settings: Settings) -> STTService:
    """Return the configured STT adapter. Unknown or unfinished providers fail closed."""
    provider = settings.stt_provider.strip().lower()
    if provider == "openai":
        delay = settings.openai_stt_delay.strip().lower()
        if delay not in OPENAI_STT_DELAYS:
            allowed = ", ".join(sorted(OPENAI_STT_DELAYS))
            raise STTConfigurationError(
                f"OPENAI_STT_DELAY must be one of: {allowed}."
            )
        return OpenAIRealtimeWhisperSTTService(
            api_key=settings.openai_api_key,
            model=settings.openai_stt_model,
            url=settings.openai_stt_wss_url(),
            language=settings.openai_stt_language,
            timeout_seconds=settings.openai_stt_timeout_seconds,
            delay=delay,
        )
    if provider == "azure":
        raise STTConfigurationError(
            "STT_PROVIDER=azure is not implemented. Add an Azure Speech "
            "adapter behind STTService, or set STT_PROVIDER=openai."
        )
    raise STTConfigurationError(
        f"Unknown STT_PROVIDER={settings.stt_provider!r}. "
        f"Implemented values: {', '.join(sorted(IMPLEMENTED_STT_PROVIDERS))}."
    )
