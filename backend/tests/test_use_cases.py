"""Unit test for health use case."""

from app.application.use_cases import GetHealthStatusUseCase


def test_get_health_status_use_case() -> None:
    use_case = GetHealthStatusUseCase(version="1.0.0")
    result = use_case.execute()

    assert result.status == "healthy"
    assert result.version == "1.0.0"
    assert result.timestamp is not None
