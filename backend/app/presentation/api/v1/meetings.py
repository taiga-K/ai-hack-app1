"""Meeting finalize and requirements document REST endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import Response

from app.application.dto import RequirementsDocumentDTO
from app.application.use_cases.generate_requirements_doc import (
    GenerateRequirementsDocUseCase,
    GetRequirementsDocUseCase,
    parse_seed_advice_item,
    parse_seed_utterance_line,
)
from app.domain.exceptions import (
    MeetingHasNoTranscriptError,
    RequirementsDocGenerationError,
    RequirementsDocNotFoundError,
)
from app.presentation.deps import (
    get_generate_requirements_doc_use_case,
    get_requirements_doc_use_case,
)
from app.presentation.schemas import (
    ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH,
    MEETING_ID_PATH_PATTERN,
    FinalizeMeetingRequest,
    RequirementsDocumentResponse,
    RequirementsSectionResponse,
)

router = APIRouter()

MeetingIdPath = Annotated[
    str,
    Path(
        pattern=MEETING_ID_PATH_PATTERN,
        max_length=ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH,
        description="Meeting identifier (letters, digits, underscore, hyphen)",
    ),
]


def _to_response(document: RequirementsDocumentDTO) -> RequirementsDocumentResponse:
    return RequirementsDocumentResponse(
        id=document.id,
        meeting_id=document.meeting_id,
        title=document.title,
        markdown=document.markdown,
        sections=[
            RequirementsSectionResponse(
                section_id=section.section_id,
                heading=section.heading,
                body_markdown=section.body_markdown,
            )
            for section in document.sections
        ],
        created_at=document.created_at,
        model=document.model,
        source_utterance_count=document.source_utterance_count,
        source_detection_count=document.source_detection_count,
    )


@router.post(
    "/meetings/{meeting_id}/finalize",
    response_model=RequirementsDocumentResponse,
)
async def finalize_meeting(
    meeting_id: MeetingIdPath,
    request: FinalizeMeetingRequest | None = None,
    use_case: GenerateRequirementsDocUseCase | None = Depends(
        get_generate_requirements_doc_use_case
    ),
) -> RequirementsDocumentResponse:
    """Generate a structured Markdown requirements document for a meeting."""
    if use_case is None:
        raise HTTPException(
            status_code=503,
            detail="LLM service is not configured (missing ORCAROUTER_API_KEY).",
        )

    payload = request or FinalizeMeetingRequest()
    extra_utterances = [
        parse_seed_utterance_line(meeting_id, line, index)
        for index, line in enumerate(payload.utterances)
    ]
    extra_advice = [
        parse_seed_advice_item(
            category=item.category,
            title=item.title,
            reason=item.reason,
            suggested_question=item.suggested_question,
            priority=item.priority,
            quote=item.quote,
            advice_id=item.id,
        )
        for item in payload.advice_items
    ]

    try:
        document = await use_case.execute(
            meeting_id=meeting_id,
            title=payload.title,
            extra_utterances=extra_utterances,
            extra_advice_items=extra_advice,
        )
    except MeetingHasNoTranscriptError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RequirementsDocGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return _to_response(document)


@router.get(
    "/meetings/{meeting_id}/requirements",
    response_model=RequirementsDocumentResponse,
)
def get_requirements_document(
    meeting_id: MeetingIdPath,
    use_case: GetRequirementsDocUseCase = Depends(get_requirements_doc_use_case),
) -> RequirementsDocumentResponse:
    """Return the generated requirements document as JSON."""
    try:
        document = use_case.execute(meeting_id)
    except RequirementsDocNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _to_response(document)


@router.get("/meetings/{meeting_id}/requirements/download")
def download_requirements_document(
    meeting_id: MeetingIdPath,
    use_case: GetRequirementsDocUseCase = Depends(get_requirements_doc_use_case),
) -> Response:
    """Download the generated requirements document as a Markdown file."""
    try:
        document = use_case.execute(meeting_id)
    except RequirementsDocNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    filename = f"requirements-{meeting_id}.md"
    return Response(
        content=document.markdown,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
