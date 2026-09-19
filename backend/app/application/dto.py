"""Application DTOs."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class HealthStatusDTO:
    """DTO for system health status."""

    status: str
    version: str
    timestamp: datetime
