"""FastAPI API routes."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from app.application.use_cases import (
    AnalyzeDialogueUseCase,
    GetHealthStatusUseCase,
)
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.transcript import Speaker, Utterance
from app.infrastructure.config import settings
from app.presentation.deps import get_analyze_dialogue_use_case
from app.presentation.schemas import (
    AdviceItemResponse,
    AnalyzeDialogueRequest,
    AnalyzeDialogueResponse,
    HealthResponse,
)

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


@router.post("/analysis/dialogue", response_model=AnalyzeDialogueResponse)
async def analyze_dialogue_endpoint(
    request: AnalyzeDialogueRequest,
    use_case: AnalyzeDialogueUseCase | None = Depends(get_analyze_dialogue_use_case),
) -> AnalyzeDialogueResponse:
    """REST endpoint to analyze dialogue and detect ambiguities/contradictions/infeasibilities."""
    if use_case is None:
        raise HTTPException(
            status_code=503,
            detail="LLM service is not configured (missing ORCAROUTER_API_KEY).",
        )

    context = MeetingDialogueContext(meeting_id=request.meeting_id)

    # Populate context from request utterances if provided
    for line in request.utterances:
        speaker = Speaker.REMOTE_CLIENT
        text = line
        if line.startswith("[自社PM]") or line.startswith("[local_pm]"):
            speaker = Speaker.LOCAL_PM
            text = line.split("]", 1)[-1].strip()
        elif line.startswith("[相手クライアント]") or line.startswith(
            "[remote_client]"
        ):
            speaker = Speaker.REMOTE_CLIENT
            text = line.split("]", 1)[-1].strip()

        context.add_utterance(
            Utterance(
                id=str(uuid.uuid4()),
                meeting_id=request.meeting_id,
                speaker=speaker,
                text=text,
                start_ms=0,
                end_ms=0,
                is_final=True,
                created_at=datetime.now(UTC),
            )
        )

    result = await use_case.execute(context=context, force_analyze=True)

    return AnalyzeDialogueResponse(
        meeting_id=result.meeting_id,
        advice_items=[
            AdviceItemResponse(
                id=item.id,
                category=item.category,
                priority=item.priority,
                title=item.title,
                reason=item.reason,
                suggested_question=item.suggested_question,
                detected_at=item.detected_at,
                quote=item.quote,
            )
            for item in result.advice_items
        ],
        analyzed_utterance_count=result.analyzed_utterance_count,
    )
