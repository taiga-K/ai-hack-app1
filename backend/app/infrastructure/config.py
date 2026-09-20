"""Infrastructure configuration via environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.domain.exceptions import STTConfigurationError


def require_wss_openai_stt_url(url: str) -> str:
    """Reject any OPENAI_STT_URL that is not a TLS WebSocket endpoint."""
    normalized = url.strip()
    if not normalized.startswith("wss://"):
        raise STTConfigurationError(
            f"OPENAI_STT_URL must use the wss:// scheme, got: {url!r}"
        )
    return normalized


class Settings(BaseSettings):
    """Application configuration."""

    app_name: str = "AI HACK APP1 API"
    app_version: str = "0.1.0"
    debug: bool = False
    orcarouter_api_key: str = ""
    orcarouter_base_url: str = "https://api.orcarouter.ai/v1"
    orcarouter_default_model: str = "deepseek/deepseek-v4-flash-free"
    orcarouter_timeout_seconds: float = 60.0
    orcarouter_requirements_model: str = "deepseek/deepseek-v4-flash-free"
    orcarouter_requirements_fallback_models: str = ""
    orcarouter_requirements_timeout_seconds: float = 120.0

    stt_provider: str = "openai"
    openai_api_key: str = ""
    openai_stt_model: str = "gpt-realtime-whisper"
    openai_stt_url: str = "wss://api.openai.com/v1/realtime"
    openai_stt_language: str = "ja"
    openai_stt_timeout_seconds: float = 30.0
    audio_sample_rate: int = 16000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def openai_stt_wss_url(self) -> str:
        """Return OPENAI_STT_URL only when it uses wss://."""
        return require_wss_openai_stt_url(self.openai_stt_url)


settings = Settings()
