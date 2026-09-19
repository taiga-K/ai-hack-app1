"""Unit tests for dialogue analysis domain models."""

from datetime import UTC, datetime

from app.domain.models.analysis import (
    AdviceItem,
    AdvicePriority,
    AnalysisResult,
    IssueCategory,
)
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.models.transcript import Speaker, Utterance


def test_meeting_dialogue_context() -> None:
    """Verify MeetingDialogueContext stores and formats utterances."""
    ctx = MeetingDialogueContext(meeting_id="meet-1")
    assert ctx.total_utterances == 0
    assert ctx.get_recent_utterances(5) == []
    assert ctx.get_formatted_transcript() == ""

    u1 = Utterance(
        id="u-1",
        meeting_id="meet-1",
        speaker=Speaker.LOCAL_PM,
        text="本日はよろしくお願いします。",
        start_ms=0,
        end_ms=1000,
        is_final=True,
        created_at=datetime.now(UTC),
    )
    u2 = Utterance(
        id="u-2",
        meeting_id="meet-1",
        speaker=Speaker.REMOTE_CLIENT,
        text="画面は使いやすい感じでお願いします。",
        start_ms=1500,
        end_ms=3000,
        is_final=True,
        created_at=datetime.now(UTC),
    )

    ctx.add_utterance(u1)
    ctx.add_utterance(u2)

    assert ctx.total_utterances == 2
    assert len(ctx.get_recent_utterances(1)) == 1
    assert ctx.get_recent_utterances(1)[0].id == "u-2"

    formatted = ctx.get_formatted_transcript()
    assert "[自社PM] 本日はよろしくお願いします。" in formatted
    assert "[相手クライアント] 画面は使いやすい感じでお願いします。" in formatted


def test_advice_item_creation() -> None:
    """Verify AdviceItem and AnalysisResult dataclasses."""
    item = AdviceItem(
        id="adv-1",
        category=IssueCategory.AMBIGUITY,
        priority=AdvicePriority.HIGH,
        title="UIの曖昧さ",
        reason="具体的な操作性や要件が定まっていないため手戻りが発生するリスクがあります。",
        suggested_question="使いやすいUIとは、具体的にどのような操作感や画面イメージを想定されていますか？",
        detected_at=datetime.now(UTC),
        quote="使いやすい感じでお願いします。",
    )

    assert item.category == IssueCategory.AMBIGUITY
    assert item.priority == AdvicePriority.HIGH
    assert item.quote == "使いやすい感じでお願いします。"

    result = AnalysisResult(
        meeting_id="meet-1",
        advice_items=[item],
        analyzed_utterance_count=2,
    )
    assert len(result.advice_items) == 1
    assert result.analyzed_utterance_count == 2


def test_advice_item_unexplained_jargon_category() -> None:
    """Verify UNEXPLAINED_JARGON category works in domain model."""
    jargon_item = AdviceItem(
        id="adv-jargon-1",
        category=IssueCategory.UNEXPLAINED_JARGON,
        priority=AdvicePriority.HIGH,
        title="専門用語『API』の共通認識不足",
        reason="専門用語の説明がなく、相手が曖昧な了解で聞き流しているため、後から認識齟齬が発生するリスクがあります。",
        suggested_question="『API』は、御社の既存システムからデータを取る接続口、という理解で合っていますか？",
        detected_at=datetime.now(UTC),
        quote="APIで連携すれば大丈夫です",
    )
    assert jargon_item.category == IssueCategory.UNEXPLAINED_JARGON
    assert jargon_item.category.value == "unexplained_jargon"
    assert "既存システムからデータを取る接続口" in jargon_item.suggested_question
