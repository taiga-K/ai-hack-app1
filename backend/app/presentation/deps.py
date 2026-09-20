"""FastAPI presentation dependencies for dependency injection."""

import logging

from app.application.use_cases import (
    AnalyzeDialogueUseCase,
    GenerateRequirementsDocUseCase,
    GetRequirementsDocUseCase,
    TranscribeAudioUseCase,
    UpdateMindMapUseCase,
)
from app.domain.exceptions import LLMConfigurationError
from app.domain.services.llm_service import LLMService
from app.domain.services.meeting_session_repository import MeetingSessionRepository
from app.domain.services.stt_service import STTService
from app.infrastructure.ai.orca_router_client import OrcaRouterClient
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.infrastructure.config import settings
from app.infrastructure.persistence.in_memory_meeting_store import (
    InMemoryMeetingSessionStore,
)
from app.infrastructure.stt.whisper_stt import FasterWhisperSTTService

logger = logging.getLogger(__name__)

# Singleton instances for STT and Diarizer to avoid reloading weights per request
_stt_service_instance: STTService | None = None
_channel_diarizer_instance: ChannelDiarizer | None = None
_meeting_session_store: InMemoryMeetingSessionStore | None = None


def _split_fallback_models(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def get_meeting_session_repository() -> MeetingSessionRepository:
    """Dependency injection provider for session-scoped meeting persistence."""
    global _meeting_session_store
    if _meeting_session_store is None:
        _meeting_session_store = InMemoryMeetingSessionStore()
    return _meeting_session_store


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


def get_stt_service() -> STTService:
    """Dependency injection provider for STTService."""
    global _stt_service_instance
    if _stt_service_instance is None:
        _stt_service_instance = FasterWhisperSTTService(
            model_size=settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
            language=settings.whisper_language,
        )
    return _stt_service_instance


def get_channel_diarizer() -> ChannelDiarizer:
    """Dependency injection provider for ChannelDiarizer."""
    global _channel_diarizer_instance
    if _channel_diarizer_instance is None:
        _channel_diarizer_instance = ChannelDiarizer(
            sample_rate=settings.audio_sample_rate
        )
    return _channel_diarizer_instance


def get_transcribe_audio_use_case() -> TranscribeAudioUseCase:
    """Dependency injection provider for TranscribeAudioUseCase."""
    return TranscribeAudioUseCase(stt_service=get_stt_service())


def get_analyze_dialogue_use_case() -> AnalyzeDialogueUseCase | None:
    """Dependency injection provider for AnalyzeDialogueUseCase.

    Returns None gracefully if ORCAROUTER_API_KEY is not configured,
    allowing audio streaming to function even without LLM credentials.
    """
    try:
        llm = get_llm_service()
        return AnalyzeDialogueUseCase(
            llm_service=llm,
            model=settings.orcarouter_default_model,
        )
    except LLMConfigurationError:
        logger.warning(
            "ORCAROUTER_API_KEY is not configured; dialogue analysis is disabled."
        )
        return None


def get_update_mind_map_use_case() -> UpdateMindMapUseCase | None:
    """Dependency injection provider for UpdateMindMapUseCase."""
    try:
        llm = get_llm_service()
        return UpdateMindMapUseCase(
            llm_service=llm,
            model=settings.orcarouter_default_model,
        )
    except LLMConfigurationError:
        logger.warning(
            "ORCAROUTER_API_KEY is not configured; mind-map updates are disabled."
        )
        return None


def get_requirements_llm_service() -> LLMService:
    """LLM client dedicated to requirements-doc generation (longer timeout)."""
    return OrcaRouterClient(
        api_key=settings.orcarouter_api_key,
        base_url=settings.orcarouter_base_url,
        default_model=settings.orcarouter_requirements_model,
        timeout=settings.orcarouter_requirements_timeout_seconds,
    )


def get_generate_requirements_doc_use_case() -> GenerateRequirementsDocUseCase | None:
    """Dependency injection provider for GenerateRequirementsDocUseCase."""
    try:
        llm = get_requirements_llm_service()
        return GenerateRequirementsDocUseCase(
            llm_service=llm,
            meeting_session_repository=get_meeting_session_repository(),
            model=settings.orcarouter_requirements_model,
            fallback_models=_split_fallback_models(
                settings.orcarouter_requirements_fallback_models
            ),
        )
    except LLMConfigurationError:
        logger.warning(
            "ORCAROUTER_API_KEY is not configured; requirements generation is disabled."
        )
        return None


def get_requirements_doc_use_case() -> GetRequirementsDocUseCase:
    """Dependency injection provider for GetRequirementsDocUseCase."""
    return GetRequirementsDocUseCase(
        meeting_session_repository=get_meeting_session_repository(),
    )
