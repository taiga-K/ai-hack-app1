"""FastAPI presentation dependencies for dependency injection."""

from app.application.use_cases import TranscribeAudioUseCase
from app.domain.services.llm_service import LLMService
from app.domain.services.stt_service import STTService
from app.infrastructure.ai.orca_router_client import OrcaRouterClient
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer
from app.infrastructure.config import settings
from app.infrastructure.stt.whisper_stt import FasterWhisperSTTService

# Singleton instances for STT and Diarizer to avoid reloading weights per request
_stt_service_instance: STTService | None = None
_channel_diarizer_instance: ChannelDiarizer | None = None


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
