"""Infrastructure configuration via environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    orcarouter_requirements_fallback_models: str = "z-ai/glm-5.3-flash-free"
    orcarouter_requirements_timeout_seconds: float = 120.0

    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_language: str = "ja"
    audio_sample_rate: int = 16000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
