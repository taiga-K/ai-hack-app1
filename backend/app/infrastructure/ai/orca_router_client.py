"""Orca Router AI Gateway client implementation (Clean Architecture Adapter)."""

import json
from collections.abc import AsyncIterator
from typing import Any

import openai
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionChunk

from app.domain.exceptions import (
    LLMAuthenticationError,
    LLMConfigurationError,
    LLMRateLimitError,
    LLMResponseError,
    LLMServiceError,
    LLMTimeoutError,
)
from app.domain.models.llm import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatStreamChunk,
    TokenUsage,
)
from app.domain.services.llm_service import LLMService

# Orca structured-outputs table: OpenAI / Grok / Gemini honor json_schema.
# DeepSeek documents json_object only. Free-catalog chat models
# (deepseek-*-free, z-ai/*-free, tencent/*-free) have no json_schema support.
_JSON_SCHEMA_PROVIDER_PREFIXES = frozenset({"openai", "grok", "google", "gemini"})


def _provider_prefix(model: str) -> str:
    return model.split("/", 1)[0]


def _supports_json_schema(model: str) -> bool:
    return _provider_prefix(model) in _JSON_SCHEMA_PROVIDER_PREFIXES


def _paid_fallback_models(selected_model: str, fallback_models: list[str]) -> list[str]:
    """Keep only usable fallback targets.

    Orca drops `-free` ids from extra_body.models after the primary, silently.
    """
    return [
        model
        for model in fallback_models
        if model and model != selected_model and not model.endswith("-free")
    ]


class OrcaRouterClient(LLMService):
    """Adapter implementing LLMService via Orca Router OpenAI-compatible API.

    Must route all calls through Orca Router (https://api.orcarouter.ai/v1).
    Direct access to downstream providers (OpenAI, Anthropic, etc.) is prohibited.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.orcarouter.ai/v1",
        default_model: str = "deepseek/deepseek-v4-flash-free",
        timeout: float = 60.0,
        client: AsyncOpenAI | None = None,
    ) -> None:
        if not api_key:
            raise LLMConfigurationError(
                "ORCAROUTER_API_KEY is not configured. Orca Router requires an API key."
            )
        self._api_key = api_key
        self._base_url = base_url
        self._default_model = default_model
        self._timeout = timeout
        self._client = client or AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
            timeout=self._timeout,
        )

    def _build_payload(self, request: ChatCompletionRequest) -> dict[str, Any]:
        """Convert domain request into OpenAI chat completion parameters."""
        selected_model = request.model or self._default_model
        messages: list[dict[str, str]] = [
            {"role": msg.role.value, "content": msg.content} for msg in request.messages
        ]
        payload: dict[str, Any] = {
            "model": selected_model,
            "messages": messages,
            "temperature": request.temperature,
        }
        if request.max_tokens is not None:
            payload["max_tokens"] = request.max_tokens

        # Orca Router fallback: omit extra_body when the chain is empty or
        # only contains `-free` ids (those cannot be fallback targets).
        paid_fallbacks = _paid_fallback_models(selected_model, request.fallback_models)
        if paid_fallbacks:
            payload["extra_body"] = {
                "models": [selected_model, *paid_fallbacks],
                "route": "fallback",
            }

        if request.response_schema is not None:
            if _supports_json_schema(selected_model):
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": request.response_schema,
                }
            else:
                # Keep the schema as prompt guidance. Do not drop it.
                payload["response_format"] = {"type": "json_object"}
                schema_for_prompt = request.response_schema.get(
                    "schema", request.response_schema
                )
                payload["messages"] = [
                    *messages,
                    {
                        "role": "user",
                        "content": (
                            "Return a single JSON object that conforms to this "
                            "json schema. Output JSON only.\n"
                            f"{json.dumps(schema_for_prompt, ensure_ascii=False)}"
                        ),
                    },
                ]

        return payload

    def _map_error(self, err: Exception) -> LLMServiceError:
        """Map SDK/HTTP exceptions to Domain exceptions."""
        if isinstance(err, openai.AuthenticationError):
            return LLMAuthenticationError(f"Orca Router authentication error: {err}")
        if isinstance(err, openai.RateLimitError):
            return LLMRateLimitError(f"Orca Router rate limit exceeded: {err}")
        if isinstance(err, openai.APITimeoutError):
            return LLMTimeoutError(f"Orca Router timeout: {err}")
        if isinstance(err, openai.APIConnectionError):
            return LLMServiceError(f"Orca Router connection error: {err}")
        if isinstance(err, openai.APIError):
            return LLMResponseError(
                f"Orca Router API error ({err.code}): {err.message}"
            )
        return LLMServiceError(f"Orca Router unexpected error: {err}")

    async def chat_completion(
        self,
        request: ChatCompletionRequest,
    ) -> ChatCompletionResponse:
        """Execute non-streaming chat completion."""
        payload = self._build_payload(request)
        try:
            response = await self._client.chat.completions.create(**payload)
        except Exception as exc:
            raise self._map_error(exc) from exc

        if not response.choices:
            raise LLMResponseError("Orca Router returned empty choices.")

        choice = response.choices[0]
        content = choice.message.content or ""
        finish_reason = choice.finish_reason

        usage: TokenUsage | None = None
        if response.usage:
            usage = TokenUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens,
            )

        expected_model = payload["model"]
        return ChatCompletionResponse(
            content=content,
            model=response.model or expected_model,
            usage=usage,
            finish_reason=finish_reason,
        )

    async def stream_chat_completion(
        self,
        request: ChatCompletionRequest,
    ) -> AsyncIterator[ChatStreamChunk]:
        """Execute streaming chat completion yielding individual chunks."""
        payload = self._build_payload(request)
        payload["stream"] = True
        payload["stream_options"] = {"include_usage": True}

        try:
            stream = await self._client.chat.completions.create(**payload)
        except Exception as exc:
            raise self._map_error(exc) from exc

        try:
            async for chunk in stream:
                if not isinstance(chunk, ChatCompletionChunk):
                    continue

                usage: TokenUsage | None = None
                if chunk.usage:
                    usage = TokenUsage(
                        prompt_tokens=chunk.usage.prompt_tokens,
                        completion_tokens=chunk.usage.completion_tokens,
                        total_tokens=chunk.usage.total_tokens,
                    )

                delta_content = ""
                finish_reason = None
                if chunk.choices:
                    first_choice = chunk.choices[0]
                    delta_content = first_choice.delta.content or ""
                    finish_reason = first_choice.finish_reason

                yield ChatStreamChunk(
                    delta_content=delta_content,
                    model=chunk.model,
                    finish_reason=finish_reason,
                    usage=usage,
                )
        except Exception as exc:
            raise self._map_error(exc) from exc
