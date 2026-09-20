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
    if not isinstance(settings_cls, type) or not issubclass(
        settings_cls, BaseSettings
    ):
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
