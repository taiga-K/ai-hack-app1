"""Unit tests for mind-map domain apply and UpdateMindMapUseCase."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.update_mind_map import UpdateMindMapUseCase
from app.domain.models.llm import ChatCompletionResponse
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.mind_map import (
    MindMapNode,
    MindMapSnapshot,
    apply_mind_map_delta,
)
from app.domain.models.transcript import Speaker, Utterance
from app.domain.services.llm_service import LLMService


def _utterance(meeting_id: str, utterance_id: str, text: str) -> Utterance:
    return Utterance(
        id=utterance_id,
        meeting_id=meeting_id,
        speaker=Speaker.REMOTE_CLIENT,
        text=text,
        start_ms=0,
        end_ms=1000,
        is_final=True,
        created_at=datetime.now(UTC),
    )


def test_apply_mind_map_delta_upserts_and_removes() -> None:
    snapshot = MindMapSnapshot(meeting_id="meet-1", revision=0)
    next_map = apply_mind_map_delta(
        snapshot,
        revision=1,
        upserts=(
            MindMapNode(id="root", label="今日の会議", parent_id=None),
            MindMapNode(id="scope", label="対象範囲", parent_id="root"),
        ),
        removes=(),
        source_utterance_count=2,
    )
    trimmed = apply_mind_map_delta(
        next_map,
        revision=2,
        upserts=(),
        removes=("scope",),
        source_utterance_count=3,
    )

    assert next_map.revision == 1
    assert {node.id for node in next_map.nodes} == {"root", "scope"}
    assert {node.id for node in trimmed.nodes} == {"root"}
    assert trimmed.source_utterance_count == 3


@pytest.mark.asyncio
async def test_update_mind_map_skips_empty_context() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    current = MindMapSnapshot(meeting_id="meet-empty", revision=0)

    result = await use_case.execute(
        MeetingDialogueContext(meeting_id="meet-empty"),
        current,
    )

    assert result.changed is False
    assert result.revision == 0
    mock_llm.chat_completion.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_mind_map_skips_when_no_new_utterances() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-same")
    ctx.add_utterance(_utterance("meet-same", "u-1", "対象範囲を確認します。"))
    current = MindMapSnapshot(
        meeting_id="meet-same",
        revision=1,
        source_utterance_count=1,
    )

    result = await use_case.execute(ctx, current)

    assert result.changed is False
    mock_llm.chat_completion.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_mind_map_parses_delta_from_llm() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(
            {
                "upserts": [
                    {
                        "id": "root",
                        "label": "今日の会議",
                        "parent_id": None,
                        "source_utterance_ids": [],
                    },
                    {
                        "id": "scope",
                        "label": "対象範囲",
                        "parent_id": "root",
                        "source_utterance_ids": ["u-1"],
                    },
                ],
                "removes": [],
            }
        ),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-map")
    ctx.add_utterance(_utterance("meet-map", "u-1", "更新申請だけが対象です。"))
    current = MindMapSnapshot(meeting_id="meet-map", revision=0)

    result = await use_case.execute(ctx, current)

    assert result.changed is True
    assert result.revision == 1
    assert [node.id for node in result.upserts] == ["root", "scope"]
    assert result.upserts[1].source_utterance_ids == ["u-1"]
    mock_llm.chat_completion.assert_awaited_once()
