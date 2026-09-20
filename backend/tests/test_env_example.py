import importlib.util
from pathlib import Path

from pydantic_settings import BaseSettings

BACKEND_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = BACKEND_ROOT / "app" / "infrastructure" / "config.py"
ENV_EXAMPLE_PATH = BACKEND_ROOT / ".env.example"


def _load_settings_class() -> type[BaseSettings]:
    spec = importlib.util.spec_from_file_location("backend_settings", CONFIG_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load Settings from {CONFIG_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    settings_cls = module.Settings
    if not isinstance(settings_cls, type) or not issubclass(settings_cls, BaseSettings):
        raise TypeError("Settings must be a BaseSettings subclass")
    return settings_cls


def test_env_example_lists_every_settings_field() -> None:
    settings_cls = _load_settings_class()
    text = ENV_EXAMPLE_PATH.read_text(encoding="utf-8")
    declared = {
        line.split("=", 1)[0]
        for line in text.splitlines()
        if line and not line.startswith("#") and "=" in line
    }
    expected = {name.upper() for name in settings_cls.model_fields}
    missing = expected - declared
    assert missing == set()


def test_settings_model_defaults_are_free_models() -> None:
    settings_cls = _load_settings_class()
    fields = settings_cls.model_fields
    example_values = {
        line.split("=", 1)[0]: line.split("=", 1)[1]
        for line in ENV_EXAMPLE_PATH.read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#") and "=" in line
    }

    assert fields["orcarouter_default_model"].default == (
        "deepseek/deepseek-v4-flash-free"
    )
    assert fields["orcarouter_requirements_model"].default == (
        "deepseek/deepseek-v4-flash-free"
    )
    assert fields["orcarouter_requirements_fallback_models"].default == ""
    assert example_values["ORCAROUTER_DEFAULT_MODEL"] == (
        fields["orcarouter_default_model"].default
    )
    assert example_values["ORCAROUTER_REQUIREMENTS_MODEL"] == (
        fields["orcarouter_requirements_model"].default
    )
    assert example_values["ORCAROUTER_REQUIREMENTS_FALLBACK_MODELS"] == (
        fields["orcarouter_requirements_fallback_models"].default
    )


def test_settings_stt_defaults_match_env_example() -> None:
    settings_cls = _load_settings_class()
    fields = settings_cls.model_fields
    example_values = {
        line.split("=", 1)[0]: line.split("=", 1)[1]
        for line in ENV_EXAMPLE_PATH.read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#") and "=" in line
    }

    assert fields["stt_provider"].default == "openai"
    assert fields["openai_stt_model"].default == "gpt-realtime-whisper"
    assert fields["openai_stt_url"].default == "wss://api.openai.com/v1/realtime"
    assert fields["openai_stt_language"].default == "ja"
    assert example_values["STT_PROVIDER"] == fields["stt_provider"].default
    assert example_values["OPENAI_STT_MODEL"] == fields["openai_stt_model"].default
    assert example_values["OPENAI_STT_URL"] == fields["openai_stt_url"].default
    assert "WHISPER_MODEL_SIZE" not in example_values
    assert "faster-whisper" not in ENV_EXAMPLE_PATH.read_text(encoding="utf-8")
