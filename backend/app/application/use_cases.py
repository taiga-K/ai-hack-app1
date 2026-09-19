"""Application use cases."""

from datetime import UTC, datetime

from app.application.dto import HealthStatusDTO


class GetHealthStatusUseCase:
    """Use case to retrieve backend system health."""

    def __init__(self, version: str = "0.1.0") -> None:
        self._version = version

    def execute(self) -> HealthStatusDTO:
        return HealthStatusDTO(
            status="healthy",
            version=self._version,
            timestamp=datetime.now(UTC),
        )
