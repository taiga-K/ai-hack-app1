"""Unit tests for mind-map domain apply and UpdateMindMapUseCase."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.update_mind_map import (
    SYSTEM_PROMPT,
    WINDOW_USER_INSTRUCTION,
    UpdateMindMapUseCase,
    _slugify_node_id,
)
from app.domain.models.llm import ChatCompletionResponse
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.mind_map import (
    MIND_MAP_MAX_DEPTH,
    MIND_MAP_SILENCE_MS,
    MindMapNode,
    MindMapSilenceBuffer,
    MindMapSnapshot,
    apply_mind_map_delta,
    mind_map_node_depth,
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


def test_slugify_node_id_is_stable_for_non_ascii() -> None:
    first = _slugify_node_id("対象範囲")
    second = _slugify_node_id("対象範囲")

    assert first == second
    assert first.startswith("topic-")
    assert first != _slugify_node_id("雑談")
    assert _slugify_node_id(" 対象範囲 ") == first


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


def test_mind_map_prompt_grows_spoken_details_without_inventing() -> None:
    assert "新しい論点だけ" not in SYSTEM_PROMPT
    assert "話に出ていない話題は作らない" in SYSTEM_PROMPT
    assert "話題が変わったら" in SYSTEM_PROMPT
    assert "その話題の子として深掘りします" in SYSTEM_PROMPT
    assert "depth 6" in SYSTEM_PROMPT
    assert "相づちやあいづちだけのウィンドウでは upserts を空" in SYSTEM_PROMPT
    assert f"depth は 1 から {MIND_MAP_MAX_DEPTH} まで" in WINDOW_USER_INSTRUCTION


def _depth_chain(*ids: str) -> tuple[MindMapNode, ...]:
    nodes: list[MindMapNode] = []
    parent: str | None = None
    for node_id in ids:
        nodes.append(MindMapNode(id=node_id, label=node_id, parent_id=parent))
        parent = node_id
    return tuple(nodes)


def test_apply_mind_map_delta_rejects_depth_six() -> None:
    snapshot = MindMapSnapshot(
        meeting_id="meet-depth",
        revision=1,
        nodes=_depth_chain("root", "d2", "d3", "d4", "d5"),
    )
    lookup = snapshot.node_lookup()
    assert mind_map_node_depth("d5", lookup) == MIND_MAP_MAX_DEPTH

    next_map = apply_mind_map_delta(
        snapshot,
        revision=2,
        upserts=(
            MindMapNode(id="d6", label="深すぎる", parent_id="d5"),
            MindMapNode(id="d5b", label="五段目の更新", parent_id="d4"),
        ),
        removes=(),
        source_utterance_count=4,
    )

    assert {node.id for node in next_map.nodes} == {
        "root",
        "d2",
        "d3",
        "d4",
        "d5",
        "d5b",
    }
    assert mind_map_node_depth("d5b", next_map.node_lookup()) == MIND_MAP_MAX_DEPTH
    assert "d6" not in next_map.node_lookup()


def test_silence_buffer_does_not_flush_on_stt_turn_cut() -> None:
    buffer = MindMapSilenceBuffer()
    buffer = buffer.accumulate(("u-1", "u-2"))
    buffer = buffer.observe_audio(speech=False, duration_ms=800)

    assert MIND_MAP_SILENCE_MS == 3000
    assert not buffer.should_flush()

    buffer = buffer.observe_audio(speech=True, duration_ms=200)
    buffer = buffer.observe_audio(speech=False, duration_ms=800)
    assert not buffer.should_flush()

    buffer = buffer.observe_audio(speech=False, duration_ms=2200)
    assert buffer.should_flush()
    emptied, window_ids = buffer.take()
    assert window_ids == ("u-1", "u-2")
    assert emptied.pending_ids == ()
    assert not emptied.should_flush()

    restored = emptied.accumulate(("u-3",)).requeue(("u-1", "u-2"))
    assert restored.pending_ids == ("u-1", "u-2", "u-3")
    assert restored.quiet_ms == 0
    assert not restored.should_flush()


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
    request = mock_llm.chat_completion.await_args.args[0]
    user_content = request.messages[1].content
    assert "新しい論点だけ" not in user_content
    assert "この沈黙ウィンドウの発話だけをマージ" in user_content
    assert "話に出ていない話題は作らない" in user_content
    assert "depth 6" in user_content


@pytest.mark.asyncio
async def test_update_mind_map_empty_delta_advances_watermark() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps({"upserts": [], "removes": []}),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-empty-delta")
    ctx.add_utterance(
        _utterance("meet-empty-delta", "u-1", "了解です。そこはお任せします。")
    )
    ctx.add_utterance(_utterance("meet-empty-delta", "u-2", "現場も同じ認識です。"))
    current = MindMapSnapshot(
        meeting_id="meet-empty-delta",
        revision=1,
        nodes=(MindMapNode(id="root", label="今日の会議", parent_id=None),),
        source_utterance_count=0,
    )

    result = await use_case.execute(ctx, current)

    assert result.changed is False
    assert result.revision == 1
    assert result.source_utterance_count == 2
    mock_llm.chat_completion.assert_awaited_once()

    skipped = await use_case.execute(
        ctx,
        MindMapSnapshot(
            meeting_id=result.meeting_id,
            revision=result.revision,
            nodes=current.nodes,
            source_utterance_count=result.source_utterance_count,
        ),
    )
    assert skipped.changed is False
    assert skipped.source_utterance_count == 2
    mock_llm.chat_completion.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_mind_map_skips_short_recent_text_unless_forced() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content='{"upserts": [], "removes": []}',
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-short")
    ctx.add_utterance(_utterance("meet-short", "u-1", "はい。"))
    current = MindMapSnapshot(meeting_id="meet-short", revision=0)

    skipped = await use_case.execute(ctx, current, force=False)
    assert skipped.changed is False
    mock_llm.chat_completion.assert_not_awaited()

    forced = await use_case.execute(ctx, current, force=True)
    assert forced.changed is False
    mock_llm.chat_completion.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_mind_map_slugifies_parent_and_remove_ids() -> None:
    root_id = _slugify_node_id("今日の会議")
    scope_id = _slugify_node_id("対象範囲")
    chatter_id = _slugify_node_id("雑談")
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(
            {
                "upserts": [
                    {
                        "id": "対象範囲",
                        "label": "対象範囲",
                        "parent_id": "今日の会議",
                        "source_utterance_ids": ["u-1"],
                    },
                ],
                "removes": ["雑談"],
            }
        ),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-slug")
    ctx.add_utterance(_utterance("meet-slug", "u-1", "更新申請だけが対象です。"))
    current = MindMapSnapshot(
        meeting_id="meet-slug",
        revision=1,
        nodes=(
            MindMapNode(id=root_id, label="今日の会議", parent_id=None),
            MindMapNode(id=chatter_id, label="雑談", parent_id=root_id),
        ),
        source_utterance_count=0,
    )

    result = await use_case.execute(ctx, current)

    assert root_id.startswith("topic-")
    assert result.changed is True
    assert [node.id for node in result.upserts] == [scope_id]
    assert result.upserts[0].parent_id == root_id
    assert result.removes == [chatter_id]
    assert {node.id for node in result.nodes} == {root_id, scope_id}
    scope_node = next(node for node in result.nodes if node.id == scope_id)
    assert scope_node.parent_id == root_id


@pytest.mark.asyncio
async def test_update_mind_map_drops_depth_six_from_llm() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(
            {
                "upserts": [
                    {
                        "id": "d6",
                        "label": "深すぎる枝",
                        "parent_id": "d5",
                        "depth": 6,
                        "source_utterance_ids": ["u-1"],
                    }
                ],
                "removes": [],
            }
        ),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-cap")
    ctx.add_utterance(
        _utterance("meet-cap", "u-1", "例外の例外の例外まで決めたいです。")
    )
    current = MindMapSnapshot(
        meeting_id="meet-cap",
        revision=1,
        nodes=_depth_chain("root", "d2", "d3", "d4", "d5"),
        source_utterance_count=0,
    )

    result = await use_case.execute(ctx, current, window=tuple(ctx.utterances[:1]))

    assert result.changed is False
    assert "d6" not in {node.id for node in result.nodes}
    assert result.source_utterance_count == 1
    mock_llm.chat_completion.assert_awaited_once()
