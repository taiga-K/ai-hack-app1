"""Unit tests for AnalyzeDialogueUseCase."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.analyze_dialogue import (
    AnalyzeDialogueUseCase,
    compute_advice_fingerprint,
)
from app.domain.exceptions import LLMServiceError
from app.domain.models.analysis import AdvicePriority, IssueCategory
from app.domain.models.llm import ChatCompletionResponse
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.transcript import Speaker, Utterance
from app.domain.services.llm_service import LLMService


def test_compute_advice_fingerprint_deterministic() -> None:
    """Verify advice fingerprint is deterministic and whitespace-insensitive."""
    fp1 = compute_advice_fingerprint(
        category="ambiguity",
        title="納期が曖昧",
        quote="なるべく早めで",
    )
    fp2 = compute_advice_fingerprint(
        category="AMBIGUITY",
        title="  納期が曖昧  ",
        quote="なるべく早めで",
    )
    assert fp1 == fp2
    assert len(fp1) == 16


@pytest.mark.asyncio
async def test_analyze_dialogue_empty_context() -> None:
    """Verify empty context returns empty analysis result without calling LLM."""
    mock_llm = AsyncMock(spec=LLMService)
    use_case = AnalyzeDialogueUseCase(llm_service=mock_llm)

    ctx = MeetingDialogueContext(meeting_id="meet-empty")
    result = await use_case.execute(ctx)

    assert result.meeting_id == "meet-empty"
    assert len(result.advice_items) == 0
    assert result.analyzed_utterance_count == 0
    mock_llm.chat_completion.assert_not_awaited()


@pytest.mark.asyncio
async def test_analyze_dialogue_skips_when_utterance_text_too_short() -> None:
    """Verify short utterance text skips LLM when not forced."""
    mock_llm = AsyncMock(spec=LLMService)
    use_case = AnalyzeDialogueUseCase(llm_service=mock_llm)

    ctx = MeetingDialogueContext(meeting_id="meet-short")
    ctx.add_utterance(
        Utterance(
            id="u-1",
            meeting_id="meet-short",
            speaker=Speaker.LOCAL_PM,
            text="はい",
            start_ms=0,
            end_ms=500,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    )

    result = await use_case.execute(ctx, force_analyze=False)
    assert len(result.advice_items) == 0
    mock_llm.chat_completion.assert_not_awaited()


@pytest.mark.asyncio
async def test_analyze_dialogue_detects_issues_successfully() -> None:
    """Verify LLM output is parsed into AdviceItemDTOs."""
    mock_llm = AsyncMock(spec=LLMService)
    llm_payload = {
        "items": [
            {
                "category": "ambiguity",
                "priority": "high",
                "title": "「使いやすい画面」の基準が曖昧",
                "reason": "ユーザーのITリテラシーや業務フローに合わせたUI設計が不明です。",
                "suggested_question": "使いやすい画面とは、具体的にどのような利用シーンやターゲット層を想定されていますでしょうか？",
                "quote": "使いやすい感じで頼むよ",
            },
            {
                "category": "contradiction",
                "priority": "high",
                "title": "納期と要件の矛盾",
                "reason": "来週リリースと完全新規開発は両立困難です。",
                "suggested_question": "来週のリリースではMVP（最小限機能）に絞り、残りは次期フェーズとするのはいかがでしょうか？",
                "quote": "来週には本番公開したい",
            },
        ]
    }
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(llm_payload),
        model="openai/gpt-4o-mini",
    )

    use_case = AnalyzeDialogueUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-real")
    ctx.add_utterance(
        Utterance(
            id="u-1",
            meeting_id="meet-real",
            speaker=Speaker.REMOTE_CLIENT,
            text="画面は使いやすい感じで頼むよ。それと来週には本番公開したいね。",
            start_ms=0,
            end_ms=4000,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    )

    result = await use_case.execute(ctx, force_analyze=True)

    assert result.meeting_id == "meet-real"
    assert len(result.advice_items) == 2

    item1 = result.advice_items[0]
    assert item1.category == IssueCategory.AMBIGUITY.value
    assert item1.priority == AdvicePriority.HIGH.value
    assert item1.title == "「使いやすい画面」の基準が曖昧"
    assert "使いやすい画面とは" in item1.suggested_question
    assert item1.quote == "使いやすい感じで頼むよ"
    assert len(item1.id) == 16

    item2 = result.advice_items[1]
    assert item2.category == IssueCategory.CONTRADICTION.value
    assert item2.title == "納期と要件の矛盾"

    mock_llm.chat_completion.assert_awaited_once()


@pytest.mark.asyncio
async def test_analyze_dialogue_handles_llm_error_gracefully() -> None:
    """Verify LLM service error does not raise exception and returns empty items."""
    mock_llm = AsyncMock(spec=LLMService)
    mock_llm.chat_completion.side_effect = LLMServiceError("Orca Router timeout")

    use_case = AnalyzeDialogueUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-err")
    ctx.add_utterance(
        Utterance(
            id="u-1",
            meeting_id="meet-err",
            speaker=Speaker.REMOTE_CLIENT,
            text="非常に長い会話ログの内容テキストがここに入ります。",
            start_ms=0,
            end_ms=3000,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    )

    result = await use_case.execute(ctx, force_analyze=True)
    assert result.meeting_id == "meet-err"
    assert len(result.advice_items) == 0
    assert result.analyzed_utterance_count == 1


@pytest.mark.asyncio
async def test_analyze_dialogue_detects_unexplained_jargon_and_vague_ack() -> None:
    """Verify detection of unexplained jargon followed by vague acknowledgment."""
    mock_llm = AsyncMock(spec=LLMService)
    llm_payload = {
        "items": [
            {
                "category": "unexplained_jargon",
                "priority": "high",
                "title": "専門用語『API連携』の共通認識不足",
                "reason": (
                    "クライアントが『はい、わかりました』と曖昧に相づちを打っており、"
                    "APIの具体的な連携範囲や前提条件の認識が揃っていないリスクがあります。"
                ),
                "suggested_question": (
                    "『API』は、御社の既存システムからデータを取る接続口、"
                    "という理解で合っていますか？"
                ),
                "quote": "データはAPIで取れますよね / はい、わかりました",
            }
        ]
    }
    mock_llm.chat_completion.return_value = ChatCompletionResponse(
        content=json.dumps(llm_payload),
        model="openai/gpt-4o-mini",
    )

    use_case = AnalyzeDialogueUseCase(llm_service=mock_llm)
    ctx = MeetingDialogueContext(meeting_id="meet-jargon")
    ctx.add_utterance(
        Utterance(
            id="u-1",
            meeting_id="meet-jargon",
            speaker=Speaker.LOCAL_PM,
            text="基幹側のデータはAPIで取れますよね。",
            start_ms=0,
            end_ms=2000,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    )
    ctx.add_utterance(
        Utterance(
            id="u-2",
            meeting_id="meet-jargon",
            speaker=Speaker.REMOTE_CLIENT,
            text="はい、わかりました。",
            start_ms=2500,
            end_ms=3500,
            is_final=True,
            created_at=datetime.now(UTC),
        )
    )

    result = await use_case.execute(ctx, force_analyze=True)

    assert result.meeting_id == "meet-jargon"
    assert len(result.advice_items) == 1
    item = result.advice_items[0]
    assert item.category == IssueCategory.UNEXPLAINED_JARGON.value
    assert item.priority == AdvicePriority.HIGH.value
    assert "専門用語『API連携』" in item.title
    assert "御社の既存システムからデータを取る接続口" in item.suggested_question
