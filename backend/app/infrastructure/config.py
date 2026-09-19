"""Infrastructure configuration via environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration."""

    app_name: str = "AI HACK APP1 API"
    app_version: str = "0.1.0"
    debug: bool = False
    orcarouter_api_key: str = ""
    orcarouter_base_url: str = "https://api.orcarouter.ai/v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
