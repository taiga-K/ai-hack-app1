"""FastAPI API routes."""

from fastapi import APIRouter, Depends

from app.application.use_cases import GetHealthStatusUseCase
from app.infrastructure.config import settings
from app.presentation.schemas import HealthResponse

router = APIRouter()


def get_health_use_case() -> GetHealthStatusUseCase:
    """Dependency injection provider for health use case."""
    return GetHealthStatusUseCase(version=settings.app_version)


@router.get("/health", response_model=HealthResponse)
def health_check(
    use_case: GetHealthStatusUseCase = Depends(get_health_use_case),
) -> HealthResponse:
    """Health check endpoint."""
    result = use_case.execute()
    return HealthResponse(
        status=result.status,
        version=result.version,
        timestamp=result.timestamp,
    )
