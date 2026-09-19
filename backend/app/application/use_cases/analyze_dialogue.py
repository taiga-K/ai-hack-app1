"""Dialogue analysis and realtime advice use case."""

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Any

from app.application.dto import AdviceItemDTO, AnalysisResultDTO
from app.domain.models.analysis import AdvicePriority, IssueCategory
from app.domain.models.llm import ChatCompletionRequest, ChatMessage, ChatRole
from app.domain.models.meeting_context import MeetingDialogueContext
from app.domain.services.llm_service import LLMService

logger = logging.getLogger(__name__)

# Structured JSON schema for Orca Router chat completion
ANALYSIS_JSON_SCHEMA: dict[str, Any] = {
    "name": "dialogue_advice_detection",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "description": (
                    "List of detected issues requiring advice or clarification. "
                    "Empty if no issues."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": [
                                "ambiguity",
                                "contradiction",
                                "infeasibility",
                                "missing",
                            ],
                            "description": (
                                "Category of the issue: ambiguity (曖昧), "
                                "contradiction (矛盾), infeasibility (無理・高リスク), "
                                "missing (要件漏れ・未確認)"
                            ),
                        },
                        "priority": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                            "description": (
                                "Urgency and priority of the advice for the PM to ask "
                                "right now."
                            ),
                        },
                        "title": {
                            "type": "string",
                            "description": (
                                "Short concise summary of the issue in Japanese "
                                "(e.g., '納期と追加要件の矛盾', '「使いやすいUI」の具体化不足')."
                            ),
                        },
                        "reason": {
                            "type": "string",
                            "description": (
                                "Clear explanation of why this is an issue and potential "
                                "project risks in Japanese."
                            ),
                        },
                        "suggested_question": {
                            "type": "string",
                            "description": (
                                "A polite, concrete question in Japanese that the PM "
                                "should ask the client immediately to resolve the issue."
                            ),
                        },
                        "quote": {
                            "type": "string",
                            "description": (
                                "Relevant snippet or quote from the conversation if "
                                "applicable."
                            ),
                        },
                    },
                    "required": [
                        "category",
                        "priority",
                        "title",
                        "reason",
                        "suggested_question",
                        "quote",
                    ],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["items"],
        "additionalProperties": False,
    },
}

SYSTEM_PROMPT = """あなたは要件定義・クライアント定期業務ヒアリングにおける超一流のシニアプロジェクトマネージャー・ITコンサルタントのAIコパイロットです。
会話ログをリアルタイムに監視し、手戻りやトラブルを未然に防ぐため、以下の4つの観点で問題点を検出してください。

1. 【曖昧（ambiguity）】:
   - 「いい感じに」「使いやすく」「なるべく早く」「適当に」等の主観的・抽象的な表現
   - 定量的な基準（レスポンス秒数、同時アクセス数、データ件数、対象ユーザー層）が不明な要望
2. 【矛盾（contradiction）】:
   - 以前の発言や決定事項と食い違う要求（例: 「来週リリース」と「ゼロからのフルスクラッチ開発」の両立など）
   - 技術的・業務ロジック的な整合性の破綻
3. 【無理・高リスク（infeasibility）】:
   - スケジュール、予算、技術的制約から実現が著しく困難または危険な要求
   - 外部依存（他社システムAPIの未確定仕様など）によるブロッカー
4. 【要件漏れ・未確認（missing）】:
   - 業務フローにおける例外系・エラーハンドリング・権限管理・運用体制の確認漏れ
   - 合意すべき重要事項（検収条件、セキュリティ要件、データ移行等）がスルーされている状態

【指示】
- 自社PMがクライアントに対して「今すぐその場で投げかけるべき具体的かつ丁寧な質問（suggested_question）」を生成してください。
- 雑談や問題のない通常の会話、すでに解決された論点については items を空リスト `[]` にしてください。過剰にアラートを出さないことが重要です。
- クライアントの発言だけでなく、PM側の聞き漏らしや前提未確認にも目を光らせてください。
- 返答はすべて指定されたJSONスキーマに従ってください。
"""


def compute_advice_fingerprint(
    category: str,
    title: str,
    quote: str | None = None,
) -> str:
    """Compute a stable fingerprint ID for an advice item to enable deduplication."""
    norm_title = "".join(title.strip().lower().split())
    norm_quote = "".join((quote or "").strip().lower().split())
    raw = f"{category.strip().lower()}:{norm_title}:{norm_quote}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


class AnalyzeDialogueUseCase:
    """Use case to detect ambiguity, contradiction, infeasibility, and missing requirements."""

    def __init__(
        self,
        llm_service: LLMService,
        model: str | None = None,
        window_size: int = 12,
    ) -> None:
        self._llm_service = llm_service
        self._model = model
        self._window_size = window_size

    async def execute(
        self,
        context: MeetingDialogueContext,
        force_analyze: bool = False,
    ) -> AnalysisResultDTO:
        """Analyze current meeting context and return actionable advice items."""
        total_count = context.total_utterances
        if total_count == 0:
            return AnalysisResultDTO(
                meeting_id=context.meeting_id,
                advice_items=[],
                analyzed_utterance_count=0,
            )

        recent_utterances = context.get_recent_utterances(limit=self._window_size)
        if not force_analyze:
            meaningful_text = " ".join(u.text.strip() for u in recent_utterances)
            if len(meaningful_text) < 10:
                return AnalysisResultDTO(
                    meeting_id=context.meeting_id,
                    advice_items=[],
                    analyzed_utterance_count=total_count,
                )

        transcript_text = context.get_formatted_transcript(limit=self._window_size)

        user_content = (
            f"以下は直近の会議発話ログです（計{len(recent_utterances)}発話）。\n"
            f"問題点（曖昧・矛盾・無理・未確認）を検出し、PMへの具体的助言と質問候補を出力してください。\n\n"
            f"--- 会話ログ開始 ---\n"
            f"{transcript_text}\n"
            f"--- 会話ログ終了 ---"
        )

        request = ChatCompletionRequest(
            messages=[
                ChatMessage(role=ChatRole.SYSTEM, content=SYSTEM_PROMPT),
                ChatMessage(role=ChatRole.USER, content=user_content),
            ],
            model=self._model,
            response_schema=ANALYSIS_JSON_SCHEMA,
            temperature=0.2,
        )

        try:
            response = await self._llm_service.chat_completion(request)
            advice_dtos = self._parse_response(response.content)
            return AnalysisResultDTO(
                meeting_id=context.meeting_id,
                advice_items=advice_dtos,
                analyzed_utterance_count=total_count,
            )
        except Exception as e:
            logger.error(
                "Error during dialogue analysis for meeting %s: %s",
                context.meeting_id,
                e,
            )
            return AnalysisResultDTO(
                meeting_id=context.meeting_id,
                advice_items=[],
                analyzed_utterance_count=total_count,
            )

    def _parse_response(self, content: str) -> list[AdviceItemDTO]:
        """Parse structured LLM output into AdviceItemDTO list."""
        if not content:
            return []

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            stripped = content.strip()
            if stripped.startswith("```json") and stripped.endswith("```"):
                stripped = stripped[7:-3].strip()
            elif stripped.startswith("```") and stripped.endswith("```"):
                stripped = stripped[3:-3].strip()
            try:
                data = json.loads(stripped)
            except Exception:
                logger.warning("Failed to parse LLM response JSON: %s", content)
                return []

        raw_items = data.get("items", [])
        now = datetime.now(UTC)
        result: list[AdviceItemDTO] = []

        valid_categories = {c.value for c in IssueCategory}
        valid_priorities = {p.value for p in AdvicePriority}

        for item in raw_items:
            cat = str(item.get("category", "ambiguity")).lower()
            if cat not in valid_categories:
                cat = IssueCategory.AMBIGUITY.value

            prio = str(item.get("priority", "medium")).lower()
            if prio not in valid_priorities:
                prio = AdvicePriority.MEDIUM.value

            title = str(item.get("title", "")).strip()
            reason = str(item.get("reason", "")).strip()
            suggested_q = str(item.get("suggested_question", "")).strip()
            quote = item.get("quote")

            if not title or not suggested_q:
                continue

            stable_id = compute_advice_fingerprint(
                category=cat,
                title=title,
                quote=quote,
            )

            advice_dto = AdviceItemDTO(
                id=stable_id,
                category=cat,
                priority=prio,
                title=title,
                reason=reason,
                suggested_question=suggested_q,
                detected_at=now,
                quote=str(quote) if quote else None,
            )
            result.append(advice_dto)

        return result
