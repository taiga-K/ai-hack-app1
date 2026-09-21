"""Unit tests for the meeting-map domain editor and UpdateMindMapUseCase."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.update_mind_map import (
    MIND_MAP_JSON_SCHEMA,
    SYSTEM_PROMPT,
    WINDOW_USER_INSTRUCTION,
    UpdateMindMapUseCase,
    _slugify_node_id,
)
from app.domain.exceptions import LLMServiceError
from app.domain.models.llm import ChatCompletionResponse
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.mind_map import (
    MIND_MAP_MAX_DEPTH,
    MIND_MAP_SILENCE_MS,
    AddNodeOperation,
    AnnotateNodeOperation,
    CorrectNodeOperation,
    MindMapDelta,
    MindMapNode,
    MindMapNodeKind,
    MindMapNodeStatus,
    MindMapPendingItem,
    MindMapRelation,
    MindMapRelationKind,
    MindMapSilenceBuffer,
    MindMapSnapshot,
    RelateNodesOperation,
    SetNodeStatusOperation,
    apply_mind_map_delta,
    mind_map_node_depth,
)
from app.domain.models.transcript import Speaker, Utterance
from app.domain.services.llm_service import LLMService


def _utterance(
    meeting_id: str,
    utterance_id: str,
    text: str,
    speaker: Speaker = Speaker.REMOTE_CLIENT,
) -> Utterance:
    return Utterance(
        id=utterance_id,
        meeting_id=meeting_id,
        speaker=speaker,
        text=text,
        start_ms=0,
        end_ms=1000,
        is_final=True,
        created_at=datetime.now(UTC),
    )


def _root_map(meeting_id: str, *extra: MindMapNode) -> MindMapSnapshot:
    return MindMapSnapshot(
        meeting_id=meeting_id,
        revision=1,
        nodes=(MindMapNode(id="root", label="今日の会議", parent_id=None), *extra),
        source_utterance_count=0,
    )


def _depth_chain(*ids: str) -> tuple[MindMapNode, ...]:
    nodes: list[MindMapNode] = []
    parent: str | None = None
    for node_id in ids:
        nodes.append(MindMapNode(id=node_id, label=node_id, parent_id=parent))
        parent = node_id
    return tuple(nodes)


def test_slugify_node_id_is_stable_for_non_ascii() -> None:
    first = _slugify_node_id("対象範囲")
    second = _slugify_node_id("対象範囲")

    assert first == second
    assert first.startswith("topic-")
    assert first != _slugify_node_id("雑談")
    assert _slugify_node_id(" 対象範囲 ") == first


def test_apply_delta_follows_the_spec_table() -> None:
    """予算 → 補足 → 別案 → 反対 → 決定 → 訂正（履歴）."""
    result = apply_mind_map_delta(
        _root_map("meet-spec"),
        MindMapDelta(
            operations=(
                AddNodeOperation(
                    MindMapNode(
                        id="budget",
                        label="予算は30万円",
                        parent_id="root",
                        kind=MindMapNodeKind.REPORT,
                        source_utterance_ids=("u-1",),
                    )
                ),
                AnnotateNodeOperation("budget", "交通費も含む", ("u-2",)),
                AddNodeOperation(
                    MindMapNode(
                        id="inhouse",
                        label="内製で進める",
                        parent_id="root",
                        kind=MindMapNodeKind.PROPOSAL,
                    )
                ),
                AddNodeOperation(
                    MindMapNode(
                        id="outsource",
                        label="外注する",
                        parent_id="root",
                        kind=MindMapNodeKind.PROPOSAL,
                        source_utterance_ids=("u-3",),
                    )
                ),
                AddNodeOperation(
                    MindMapNode(
                        id="deadline-risk",
                        label="外注だと納期に間に合わない",
                        parent_id="outsource",
                        kind=MindMapNodeKind.CONCERN,
                    )
                ),
                RelateNodesOperation(
                    "deadline-risk", MindMapRelationKind.OPPOSES, "outsource"
                ),
                AddNodeOperation(
                    MindMapNode(
                        id="decide-inhouse",
                        label="今回は内製で決定",
                        parent_id="root",
                        kind=MindMapNodeKind.DECISION,
                        status=MindMapNodeStatus.DECIDED,
                    )
                ),
                RelateNodesOperation(
                    "decide-inhouse", MindMapRelationKind.SUPPORTS, "inhouse"
                ),
                SetNodeStatusOperation("inhouse", MindMapNodeStatus.DECIDED),
                CorrectNodeOperation(
                    "budget", label="予算は40万円", detail="30万円ではなく40万円"
                ),
            ),
            pending=(),
        ),
        source_utterance_count=6,
    )

    by_id = result.snapshot.node_lookup()
    assert result.changed is True
    assert result.snapshot.revision == 2
    assert by_id["budget"].label == "予算は40万円"
    assert by_id["budget"].history == ("予算は30万円",)
    assert by_id["budget"].detail == "交通費も含む\n30万円ではなく40万円"
    assert by_id["budget"].source_utterance_ids == ("u-1", "u-2")
    assert by_id["outsource"].parent_id == by_id["inhouse"].parent_id == "root"
    assert by_id["deadline-risk"].relations == (
        MindMapRelation(MindMapRelationKind.OPPOSES, "outsource"),
    )
    assert by_id["inhouse"].status == MindMapNodeStatus.DECIDED
    assert by_id["outsource"].status == MindMapNodeStatus.OPEN
    assert by_id["decide-inhouse"].relations[0].target_id == "inhouse"
    assert set(result.changed_node_ids) == {
        "budget",
        "inhouse",
        "outsource",
        "deadline-risk",
        "decide-inhouse",
    }


def test_apply_delta_keeps_depth_six_as_parent_detail() -> None:
    snapshot = MindMapSnapshot(
        meeting_id="meet-depth",
        revision=1,
        nodes=_depth_chain("root", "d2", "d3", "d4", "d5"),
    )
    assert mind_map_node_depth("d5", snapshot.node_lookup()) == MIND_MAP_MAX_DEPTH

    result = apply_mind_map_delta(
        snapshot,
        MindMapDelta(
            operations=(
                AddNodeOperation(
                    MindMapNode(
                        id="d6",
                        label="深すぎる",
                        parent_id="d5",
                        detail="例外の例外",
                        source_utterance_ids=("u-9",),
                    )
                ),
                AddNodeOperation(
                    MindMapNode(id="d5b", label="五段目の並列", parent_id="d4")
                ),
            )
        ),
        source_utterance_count=4,
    )

    by_id = result.snapshot.node_lookup()
    assert "d6" not in by_id
    assert by_id["d5"].detail == "深すぎる: 例外の例外"
    assert by_id["d5"].source_utterance_ids == ("u-9",)
    assert mind_map_node_depth("d5b", by_id) == MIND_MAP_MAX_DEPTH
    assert set(result.changed_node_ids) == {"d5", "d5b"}


def test_apply_delta_defers_children_and_falls_back_to_root() -> None:
    result = apply_mind_map_delta(
        _root_map("meet-order"),
        MindMapDelta(
            operations=(
                AddNodeOperation(
                    MindMapNode(id="child", label="子", parent_id="parent")
                ),
                RelateNodesOperation("child", MindMapRelationKind.SUPPORTS, "parent"),
                AddNodeOperation(
                    MindMapNode(id="parent", label="親", parent_id="root")
                ),
                AddNodeOperation(
                    MindMapNode(id="lost", label="親不明", parent_id="ghost")
                ),
                AddNodeOperation(
                    MindMapNode(
                        id="second-root", label="二つ目のルート", parent_id=None
                    )
                ),
            )
        ),
        source_utterance_count=1,
    )

    by_id = result.snapshot.node_lookup()
    assert by_id["child"].parent_id == "parent"
    assert by_id["child"].relations == (
        MindMapRelation(MindMapRelationKind.SUPPORTS, "parent"),
    )
    assert by_id["lost"].parent_id == "root"
    assert by_id["second-root"].parent_id == "root"
    assert result.snapshot.root_id() == "root"


def test_apply_delta_makes_first_parented_add_the_root_of_an_empty_map() -> None:
    result = apply_mind_map_delta(
        MindMapSnapshot(meeting_id="meet-first", revision=0),
        MindMapDelta(
            operations=(
                AddNodeOperation(
                    MindMapNode(id="budget", label="予算は30万円", parent_id="root")
                ),
                AddNodeOperation(
                    MindMapNode(id="travel", label="交通費を含む", parent_id="budget")
                ),
                AddNodeOperation(
                    MindMapNode(id="release", label="公開は来月末", parent_id="root")
                ),
            )
        ),
        source_utterance_count=2,
    )

    by_id = result.snapshot.node_lookup()
    assert result.changed is True
    assert result.snapshot.root_id() == "budget"
    assert by_id["budget"].parent_id is None
    assert by_id["travel"].parent_id == "budget"
    assert by_id["release"].parent_id == "budget"
    assert set(result.changed_node_ids) == {"budget", "travel", "release"}


def test_apply_delta_does_not_invert_out_of_order_adds_on_empty_map() -> None:
    result = apply_mind_map_delta(
        MindMapSnapshot(meeting_id="meet-empty-order", revision=0),
        MindMapDelta(
            operations=(
                AddNodeOperation(
                    MindMapNode(id="child", label="子", parent_id="parent")
                ),
                AddNodeOperation(
                    MindMapNode(id="parent", label="親", parent_id="root")
                ),
            )
        ),
        source_utterance_count=1,
    )

    by_id = result.snapshot.node_lookup()
    assert result.snapshot.root_id() == "parent"
    assert by_id["parent"].parent_id is None
    assert by_id["child"].parent_id == "parent"


def test_apply_delta_supersedes_and_respects_pinned() -> None:
    pinned = MindMapNode(
        id="fixed",
        label="人が固定した内容",
        parent_id="root",
        status=MindMapNodeStatus.DECIDED,
        pinned=True,
    )
    old_decision = MindMapNode(
        id="old",
        label="前の決定",
        parent_id="root",
        kind=MindMapNodeKind.DECISION,
        status=MindMapNodeStatus.DECIDED,
    )
    result = apply_mind_map_delta(
        _root_map("meet-pin", pinned, old_decision),
        MindMapDelta(
            operations=(
                CorrectNodeOperation("fixed", label="書き換え"),
                SetNodeStatusOperation("fixed", MindMapNodeStatus.OPEN),
                AnnotateNodeOperation("fixed", "補足は足せる"),
                AddNodeOperation(
                    MindMapNode(
                        id="new",
                        label="新しい決定",
                        parent_id="root",
                        kind=MindMapNodeKind.DECISION,
                        status=MindMapNodeStatus.DECIDED,
                    )
                ),
                RelateNodesOperation("new", MindMapRelationKind.SUPERSEDES, "old"),
            )
        ),
        source_utterance_count=3,
    )

    by_id = result.snapshot.node_lookup()
    assert by_id["fixed"].label == "人が固定した内容"
    assert by_id["fixed"].status == MindMapNodeStatus.DECIDED
    assert by_id["fixed"].history == ()
    assert by_id["fixed"].detail == "補足は足せる"
    assert by_id["old"].status == MindMapNodeStatus.SUPERSEDED
    assert by_id["new"].relations == (
        MindMapRelation(MindMapRelationKind.SUPERSEDES, "old"),
    )


def test_apply_delta_without_changes_keeps_revision_and_pending() -> None:
    held = (MindMapPendingItem(text="例外の扱いは未定", source_utterance_ids=("u-2",)),)
    snapshot = MindMapSnapshot(
        meeting_id="meet-still",
        revision=3,
        nodes=(MindMapNode(id="root", label="今日の会議", parent_id=None),),
        pending=held,
        source_utterance_count=2,
    )

    unchanged = apply_mind_map_delta(
        snapshot,
        MindMapDelta(
            operations=(
                AnnotateNodeOperation("root", ""),
                SetNodeStatusOperation("missing", MindMapNodeStatus.DECIDED),
            ),
            pending=None,
        ),
        source_utterance_count=4,
    )
    resolved = apply_mind_map_delta(
        snapshot, MindMapDelta(pending=()), source_utterance_count=4
    )

    assert unchanged.changed is False
    assert unchanged.snapshot.revision == 3
    assert unchanged.snapshot.pending == held
    assert unchanged.snapshot.source_utterance_count == 4
    assert resolved.changed is True
    assert resolved.pending_changed is True
    assert resolved.snapshot.revision == 4
    assert resolved.snapshot.pending == ()


def test_silence_buffer_flushes_after_one_second_of_pcm_silence() -> None:
    assert MIND_MAP_SILENCE_MS == 1000
    buffer = MindMapSilenceBuffer().accumulate(("u-1",))
    buffer = buffer.observe_audio(speech=False, duration_ms=800)
    assert not buffer.should_flush()

    buffer = buffer.observe_audio(speech=True, duration_ms=100)
    buffer = buffer.observe_audio(speech=False, duration_ms=900)
    assert not buffer.should_flush()

    buffer = buffer.observe_audio(speech=False, duration_ms=100)
    assert buffer.should_flush()

    emptied, window_ids = buffer.take()
    assert window_ids == ("u-1",)
    assert emptied.pending_ids == ()
    assert emptied.quiet_ms == 0
    assert not emptied.should_flush()


def test_silence_buffer_flushes_late_final_during_ongoing_pause() -> None:
    quiet = MindMapSilenceBuffer().observe_audio(speech=False, duration_ms=1500)
    assert not quiet.should_flush()

    with_final = quiet.accumulate(("u-late",))
    assert with_final.quiet_ms == 1500
    assert with_final.should_flush()


def test_silence_buffer_requeues_failed_window_with_backoff() -> None:
    emptied, _ = MindMapSilenceBuffer().accumulate(("u-1", "u-2")).take()
    later = emptied.accumulate(("u-3",))
    requeued = later.requeue(("u-1", "u-2"))

    assert requeued.pending_ids == ("u-1", "u-2", "u-3")
    assert requeued.failures == 1
    assert requeued.required_silence_ms == 2000
    assert not requeued.observe_audio(speech=False, duration_ms=1000).should_flush()
    assert requeued.observe_audio(speech=False, duration_ms=2000).should_flush()

    capped = requeued.requeue(("u-1",)).requeue(("u-1",)).requeue(("u-1",))
    assert capped.required_silence_ms == 8000

    settled = capped.settle()
    assert settled.failures == 0
    assert settled.required_silence_ms == 1000
    assert settled.pending_ids == ("u-1", "u-2", "u-3")


def test_mind_map_prompt_is_an_editor_of_the_existing_map() -> None:
    assert "新しい論点だけ" not in SYSTEM_PROMPT
    assert "編集者" in SYSTEM_PROMPT
    assert "創作しない" in SYSTEM_PROMPT
    assert "明示的な合意がなければ decision にしない" in SYSTEM_PROMPT
    assert "supports / opposes" in SYSTEM_PROMPT
    assert "supersedes" in SYSTEM_PROMPT
    assert f"depth {MIND_MAP_MAX_DEPTH + 1} になる内容は親の detail" in SYSTEM_PROMPT
    assert "以前の話題への復帰なら、その既存の枝を使う" in SYSTEM_PROMPT
    assert "相づちや雑談だけなら operations は空配列" in SYSTEM_PROMPT
    assert "pinned=true のノードは変更しない" in SYSTEM_PROMPT
    assert "当たらなくなったら、そのノードを set_status で superseded" in SYSTEM_PROMPT
    assert "「こちら」（自社）「むこう」（相手）" in SYSTEM_PROMPT
    assert "source_utterance_ids" in SYSTEM_PROMPT
    assert "今回のウィンドウの発話だけ" in WINDOW_USER_INSTRUCTION
    schema = MIND_MAP_JSON_SCHEMA["schema"]
    assert set(schema["required"]) == {"operations", "pending"}
    operation = schema["properties"]["operations"]["items"]["properties"]
    assert operation["op"]["enum"] == [
        "add",
        "annotate",
        "correct",
        "relate",
        "set_status",
    ]
    assert "supports" in operation["relation"]["enum"]


@pytest.mark.asyncio
async def test_update_mind_map_skips_empty_window_without_llm() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    current = MindMapSnapshot(meeting_id="meet-empty", revision=0)

    result = await use_case.execute(
        MeetingDialogueContext(meeting_id="meet-empty"), current, window=()
    )

    assert result.changed is False
    assert result.analyzed is True
    assert result.revision == 0
    mock_llm.chat_completion.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_mind_map_parses_operations_and_pending_from_llm() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(
            {
                "operations": [
                    {
                        "op": "add",
                        "id": "root",
                        "parent_id": None,
                        "kind": "topic",
                        "label": "今日の会議",
                        "detail": None,
                        "status": None,
                        "relation": None,
                        "target_id": None,
                        "source_utterance_ids": [],
                    },
                    {
                        "op": "add",
                        "id": "Budget",
                        "parent_id": "root",
                        "kind": "report",
                        "label": "予算は30万円",
                        "detail": "交通費を含む想定",
                        "status": None,
                        "relation": None,
                        "target_id": None,
                        "source_utterance_ids": ["u1", "u9", "not-an-id"],
                    },
                    {
                        "op": "set_status",
                        "id": "budget",
                        "parent_id": None,
                        "kind": None,
                        "label": None,
                        "detail": None,
                        "status": "decided",
                        "relation": None,
                        "target_id": None,
                        "source_utterance_ids": ["u1"],
                    },
                    {
                        "op": "teleport",
                        "id": "budget",
                        "source_utterance_ids": [],
                    },
                ],
                "pending": [
                    {"text": "納期の話は途中", "source_utterance_ids": ["u1"]},
                ],
            }
        ),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-map")
    ctx.add_utterance(
        _utterance("meet-map", "8f1c-uuid-1", "予算は30万円を想定しています。")
    )
    current = MindMapSnapshot(meeting_id="meet-map", revision=0)

    result = await use_case.execute(ctx, current, window=tuple(ctx.utterances))

    assert result.analyzed is True
    assert result.changed is True
    assert result.revision == 1
    assert result.source_utterance_count == 1
    assert [node.id for node in result.upserts] == ["root", "budget"]
    budget = result.upserts[1]
    assert budget.kind == "report"
    assert budget.status == "decided"
    assert budget.detail == "交通費を含む想定"
    assert budget.source_utterance_ids == ["8f1c-uuid-1"]
    assert [item.text for item in result.pending] == ["納期の話は途中"]
    assert result.pending[0].source_utterance_ids == ["8f1c-uuid-1"]

    mock_llm.chat_completion.assert_awaited_once()
    request = mock_llm.chat_completion.await_args.args[0]
    assert request.response_schema is MIND_MAP_JSON_SCHEMA
    user_content = request.messages[1].content
    assert "## 現在の地図" in user_content
    assert "## 保留（pending）" in user_content
    assert "## 今回のウィンドウ（計1）" in user_content
    assert "(u1) [相手クライアント] 予算は30万円を想定しています。" in user_content
    assert "8f1c-uuid-1" not in user_content
    assert WINDOW_USER_INSTRUCTION in user_content
    assert "新しい論点だけ" not in user_content


@pytest.mark.asyncio
async def test_update_mind_map_prompt_carries_map_pending_and_context() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps({"operations": [], "pending": None}),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-ctx")
    lines = [
        ("u-1", "予算は30万円を想定しています。"),
        ("u-2", "公開時期は来月末を狙います。"),
        *[(f"u-f{index}", f"雑談その{index}です。") for index in range(6)],
        ("u-3", "了解です。"),
        ("u-4", "さっきの予算に戻りますが、交通費も含みます。"),
    ]
    for utterance_id, text in lines:
        ctx.add_utterance(_utterance("meet-ctx", utterance_id, text))
    current = MindMapSnapshot(
        meeting_id="meet-ctx",
        revision=2,
        nodes=(
            MindMapNode(id="root", label="今日の会議", parent_id=None),
            MindMapNode(
                id="budget",
                label="予算は30万円",
                parent_id="root",
                kind=MindMapNodeKind.REPORT,
                detail="初期見積もり",
                source_utterance_ids=("u-1",),
            ),
            MindMapNode(
                id="release",
                label="公開は来月末",
                parent_id="root",
                source_utterance_ids=("u-2",),
            ),
        ),
        pending=(MindMapPendingItem(text="例外の扱い", source_utterance_ids=("u-3",)),),
        source_utterance_count=9,
    )

    result = await use_case.execute(ctx, current, window=(ctx.utterances[-1],))

    assert result.changed is False
    assert result.analyzed is True
    assert result.source_utterance_count == 10
    assert [item.text for item in result.pending] == ["例外の扱い"]
    user_content = mock_llm.chat_completion.await_args.args[0].messages[1].content
    assert "id=budget" in user_content
    assert "kind=report" in user_content
    assert 'detail="初期見積もり"' in user_content
    assert "- 例外の扱い" in user_content
    assert "## 過去の関連発話" in user_content
    related_section = user_content.split("## 過去の関連発話")[1].split("## 直前")[0]
    assert "予算は30万円を想定しています。" in related_section
    assert "公開時期は来月末を狙います。" not in related_section
    preceding_section = user_content.split("## 直前の発話")[1].split("## 今回")[0]
    assert "了解です。" in preceding_section
    assert "雑談その5です。" in preceding_section
    assert "雑談その0です。" not in preceding_section
    assert "予算は30万円を想定しています。" not in preceding_section
    window_section = user_content.split("## 今回のウィンドウ")[1]
    assert "さっきの予算に戻りますが" in window_section
    assert "了解です。" not in window_section


@pytest.mark.asyncio
async def test_update_mind_map_reports_failures_as_not_analyzed() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.side_effect = LLMServiceError("orca down")
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-fail")
    ctx.add_utterance(_utterance("meet-fail", "u-1", "対象範囲を決めたいです。"))
    current = MindMapSnapshot(
        meeting_id="meet-fail",
        revision=1,
        nodes=(MindMapNode(id="root", label="今日の会議", parent_id=None),),
        source_utterance_count=0,
    )

    failed = await use_case.execute(ctx, current, window=tuple(ctx.utterances))
    assert failed.analyzed is False
    assert failed.changed is False
    assert failed.revision == 1
    assert failed.source_utterance_count == 0

    mock_llm.chat_completion.side_effect = None
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content="これはJSONではありません", model="openai/gpt-4o-mini"
    )
    garbled = await use_case.execute(ctx, current, window=tuple(ctx.utterances))
    assert garbled.analyzed is False
    assert garbled.source_utterance_count == 0


@pytest.mark.asyncio
async def test_update_mind_map_empty_operations_advance_watermark_only() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps({"operations": [], "pending": None}),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-nod")
    ctx.add_utterance(_utterance("meet-nod", "u-1", "了解です。そこはお任せします。"))
    ctx.add_utterance(_utterance("meet-nod", "u-2", "現場も同じ認識です。"))
    current = MindMapSnapshot(
        meeting_id="meet-nod",
        revision=1,
        nodes=(MindMapNode(id="root", label="今日の会議", parent_id=None),),
        source_utterance_count=0,
    )

    result = await use_case.execute(ctx, current, window=tuple(ctx.utterances))

    assert result.analyzed is True
    assert result.changed is False
    assert result.revision == 1
    assert result.upserts == []
    assert result.source_utterance_count == 2
    mock_llm.chat_completion.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_mind_map_moves_depth_six_from_llm_into_detail() -> None:
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(
            {
                "operations": [
                    {
                        "op": "add",
                        "id": "d6",
                        "parent_id": "d5",
                        "kind": "topic",
                        "label": "深すぎる枝",
                        "detail": None,
                        "status": None,
                        "relation": None,
                        "target_id": None,
                        "source_utterance_ids": ["u1"],
                    }
                ],
                "pending": None,
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

    result = await use_case.execute(ctx, current, window=tuple(ctx.utterances))

    assert result.changed is True
    assert "d6" not in {node.id for node in result.nodes}
    assert [node.id for node in result.upserts] == ["d5"]
    assert result.upserts[0].detail == "深すぎる枝"
    assert result.upserts[0].source_utterance_ids == ["u-1"]
    assert result.source_utterance_count == 1


@pytest.mark.asyncio
async def test_update_mind_map_slugifies_ids_and_relations() -> None:
    root_id = _slugify_node_id("今日の会議")
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(
            {
                "operations": [
                    {
                        "op": "add",
                        "id": "外注案",
                        "parent_id": "今日の会議",
                        "kind": "proposal",
                        "label": "外注する",
                        "detail": None,
                        "status": None,
                        "relation": None,
                        "target_id": None,
                        "source_utterance_ids": ["u1"],
                    },
                    {
                        "op": "relate",
                        "id": "外注案",
                        "parent_id": None,
                        "kind": None,
                        "label": None,
                        "detail": None,
                        "status": None,
                        "relation": "OPPOSES",
                        "target_id": "In-House",
                        "source_utterance_ids": ["u1"],
                    },
                ],
                "pending": [],
            }
        ),
        model="openai/gpt-4o-mini",
    )
    use_case = UpdateMindMapUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-slug")
    ctx.add_utterance(_utterance("meet-slug", "u-1", "別案として外注もあります。"))
    current = MindMapSnapshot(
        meeting_id="meet-slug",
        revision=1,
        nodes=(
            MindMapNode(id=root_id, label="今日の会議", parent_id=None),
            MindMapNode(
                id="in-house",
                label="内製で進める",
                parent_id=root_id,
                kind=MindMapNodeKind.PROPOSAL,
            ),
        ),
        source_utterance_count=0,
    )

    result = await use_case.execute(ctx, current, window=tuple(ctx.utterances))

    outsourced_id = _slugify_node_id("外注案")
    assert root_id.startswith("topic-")
    assert result.changed is True
    assert [node.id for node in result.upserts] == [outsourced_id]
    assert result.upserts[0].parent_id == root_id
    assert result.upserts[0].kind == "proposal"
    assert result.upserts[0].relations[0].kind == "opposes"
    assert result.upserts[0].relations[0].target_id == "in-house"
