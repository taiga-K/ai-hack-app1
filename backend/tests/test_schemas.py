"""Unit tests for presentation request schema limits."""

import pytest
from pydantic import ValidationError

from app.presentation.schemas import (
    ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH,
    ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH,
    ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS,
    AnalyzeDialogueRequest,
)


def test_analyze_dialogue_request_accepts_boundary_sizes() -> None:
    request = AnalyzeDialogueRequest(
        meeting_id="m" * ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH,
        utterances=["あ" * ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH]
        * ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS,
    )
    assert len(request.meeting_id) == ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH
    assert len(request.utterances) == ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS
    assert len(request.utterances[0]) == ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH


def test_analyze_dialogue_request_rejects_meeting_id_over_max_length() -> None:
    with pytest.raises(ValidationError) as exc_info:
        AnalyzeDialogueRequest(
            meeting_id="m" * (ANALYZE_DIALOGUE_MEETING_ID_MAX_LENGTH + 1),
            utterances=[],
        )
    assert "meeting_id" in str(exc_info.value)


def test_analyze_dialogue_request_rejects_utterances_over_max_items() -> None:
    with pytest.raises(ValidationError) as exc_info:
        AnalyzeDialogueRequest(
            meeting_id="meet-1",
            utterances=["発話"] * (ANALYZE_DIALOGUE_UTTERANCES_MAX_ITEMS + 1),
        )
    assert "utterances" in str(exc_info.value)


def test_analyze_dialogue_request_rejects_utterance_over_max_length() -> None:
    with pytest.raises(ValidationError) as exc_info:
        AnalyzeDialogueRequest(
            meeting_id="meet-1",
            utterances=["あ" * (ANALYZE_DIALOGUE_UTTERANCE_MAX_LENGTH + 1)],
        )
    assert "utterances" in str(exc_info.value)
