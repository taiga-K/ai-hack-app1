"""Unit tests for Orca Router client and Clean Architecture LLM domain port."""

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import openai
import pytest
from openai.types.chat import (
    ChatCompletion,
    ChatCompletionChunk,
    ChatCompletionMessage,
)
from openai.types.chat.chat_completion import Choice
from openai.types.chat.chat_completion_chunk import (
    Choice as ChunkChoice,
)
from openai.types.chat.chat_completion_chunk import (
    ChoiceDelta,
)
from openai.types.completion_usage import CompletionUsage

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
    ChatMessage,
    ChatRole,
    ChatStreamChunk,
    TokenUsage,
)
from app.domain.services.llm_service import LLMService
from app.infrastructure.ai.orca_router_client import OrcaRouterClient


def test_orca_router_client_implements_protocol() -> None:
    """Verify OrcaRouterClient satisfies the domain LLMService protocol."""
    client = OrcaRouterClient(api_key="test-key")
    assert isinstance(client, LLMService)


def test_orca_router_client_missing_api_key() -> None:
    """Verify initialization raises LLMConfigurationError when api_key is empty."""
    with pytest.raises(LLMConfigurationError) as exc_info:
        OrcaRouterClient(api_key="")
    assert "ORCAROUTER_API_KEY is not configured" in str(exc_info.value)


def test_build_payload_basic() -> None:
    """Verify payload generation for basic request."""
    client = OrcaRouterClient(api_key="test-key")
    request = ChatCompletionRequest(
        messages=[
            ChatMessage(role=ChatRole.SYSTEM, content="You are an assistant"),
            ChatMessage(role=ChatRole.USER, content="Hello"),
        ],
        model="openai/gpt-4o-mini",
        temperature=0.5,
        max_tokens=100,
    )
    payload = client._build_payload(request)
    assert payload["model"] == "openai/gpt-4o-mini"
    assert payload["temperature"] == 0.5
    assert payload["max_tokens"] == 100
    assert payload["messages"] == [
        {"role": "system", "content": "You are an assistant"},
        {"role": "user", "content": "Hello"},
    ]
    assert "extra_body" not in payload
    assert "response_format" not in payload


def test_build_payload_with_fallback_models() -> None:
    """Verify payload generation with Orca Router fallback route."""
    client = OrcaRouterClient(api_key="test-key")
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hi")],
        model="openai/gpt-4o-mini",
        fallback_models=["anthropic/claude-3-5-sonnet", "openai/gpt-4o"],
    )
    payload = client._build_payload(request)
    assert "extra_body" in payload
    assert payload["extra_body"] == {
        "models": [
            "openai/gpt-4o-mini",
            "anthropic/claude-3-5-sonnet",
            "openai/gpt-4o",
        ],
        "route": "fallback",
    }


def test_build_payload_with_response_schema() -> None:
    """Verify payload generation with structured outputs JSON schema."""
    client = OrcaRouterClient(api_key="test-key")
    schema: dict[str, Any] = {
        "name": "analysis_output",
        "schema": {"type": "object", "properties": {"ambiguities": {"type": "array"}}},
    }
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Analyze")],
        model="openai/gpt-4o-mini",
        response_schema=schema,
    )
    payload = client._build_payload(request)
    assert payload["response_format"] == {
        "type": "json_schema",
        "json_schema": schema,
    }


@pytest.mark.asyncio
async def test_chat_completion_success() -> None:
    """Verify successful non-streaming chat completion."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock()
    mock_sdk_client.chat.completions.create = mock_chat_completions

    fake_response = ChatCompletion(
        id="chatcmpl-123",
        choices=[
            Choice(
                finish_reason="stop",
                index=0,
                message=ChatCompletionMessage(
                    content="Hello from Orca Router!",
                    role="assistant",
                ),
            )
        ],
        created=1677652288,
        model="openai/gpt-4o-mini",
        object="chat.completion",
        usage=CompletionUsage(
            completion_tokens=10,
            prompt_tokens=5,
            total_tokens=15,
        ),
    )
    mock_chat_completions.return_value = fake_response

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hello")],
        model="openai/gpt-4o-mini",
    )

    response = await client.chat_completion(request)

    assert response.content == "Hello from Orca Router!"
    assert response.model == "openai/gpt-4o-mini"
    assert response.finish_reason == "stop"
    assert response.usage == TokenUsage(
        prompt_tokens=5,
        completion_tokens=10,
        total_tokens=15,
    )
    mock_chat_completions.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_completion_empty_choices() -> None:
    """Verify exception when Orca Router returns empty choices list."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock()
    mock_sdk_client.chat.completions.create = mock_chat_completions

    fake_response = ChatCompletion(
        id="chatcmpl-123",
        choices=[],
        created=1677652288,
        model="openai/gpt-4o-mini",
        object="chat.completion",
    )
    mock_chat_completions.return_value = fake_response

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hello")],
    )

    with pytest.raises(LLMResponseError) as exc_info:
        await client.chat_completion(request)
    assert "empty choices" in str(exc_info.value)


@pytest.mark.asyncio
async def test_stream_chat_completion_success() -> None:
    """Verify streaming chat completion yields chunks and handles usage."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock()
    mock_sdk_client.chat.completions.create = mock_chat_completions

    chunk1 = ChatCompletionChunk(
        id="chunk-1",
        choices=[
            ChunkChoice(
                delta=ChoiceDelta(content="Hello", role="assistant"),
                finish_reason=None,
                index=0,
            )
        ],
        created=1677652288,
        model="openai/gpt-4o-mini",
        object="chat.completion.chunk",
    )
    chunk2 = ChatCompletionChunk(
        id="chunk-2",
        choices=[
            ChunkChoice(
                delta=ChoiceDelta(content=" world!"),
                finish_reason="stop",
                index=0,
            )
        ],
        created=1677652288,
        model="openai/gpt-4o-mini",
        object="chat.completion.chunk",
        usage=CompletionUsage(
            completion_tokens=4,
            prompt_tokens=2,
            total_tokens=6,
        ),
    )

    async def mock_stream_gen() -> AsyncIterator[ChatCompletionChunk]:
        yield chunk1
        yield chunk2

    mock_chat_completions.return_value = mock_stream_gen()

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hi")],
    )

    chunks: list[ChatStreamChunk] = []
    async for chunk in client.stream_chat_completion(request):
        chunks.append(chunk)

    assert len(chunks) == 2
    assert chunks[0].delta_content == "Hello"
    assert chunks[0].finish_reason is None
    assert chunks[1].delta_content == " world!"
    assert chunks[1].finish_reason == "stop"
    assert chunks[1].usage == TokenUsage(
        prompt_tokens=2,
        completion_tokens=4,
        total_tokens=6,
    )


@pytest.mark.asyncio
async def test_error_mapping_authentication() -> None:
    """Verify mapping of openai.AuthenticationError to LLMAuthenticationError."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock(
        side_effect=openai.AuthenticationError(
            message="Invalid API Key",
            response=MagicMock(status_code=401),
            body=None,
        )
    )
    mock_sdk_client.chat.completions.create = mock_chat_completions

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hello")],
    )

    with pytest.raises(LLMAuthenticationError):
        await client.chat_completion(request)


@pytest.mark.asyncio
async def test_error_mapping_rate_limit() -> None:
    """Verify mapping of openai.RateLimitError to LLMRateLimitError."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock(
        side_effect=openai.RateLimitError(
            message="Rate limit reached",
            response=MagicMock(status_code=429),
            body=None,
        )
    )
    mock_sdk_client.chat.completions.create = mock_chat_completions

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hello")],
    )

    with pytest.raises(LLMRateLimitError):
        await client.chat_completion(request)


@pytest.mark.asyncio
async def test_error_mapping_timeout() -> None:
    """Verify mapping of openai.APITimeoutError to LLMTimeoutError."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock(
        side_effect=openai.APITimeoutError(
            request=MagicMock(),
        )
    )
    mock_sdk_client.chat.completions.create = mock_chat_completions

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hello")],
    )

    with pytest.raises(LLMTimeoutError):
        await client.chat_completion(request)


@pytest.mark.asyncio
async def test_error_mapping_generic_api_error() -> None:
    """Verify mapping of openai.APIError to LLMResponseError."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock(
        side_effect=openai.APIError(
            message="Internal Orca Router Error",
            request=MagicMock(),
            body={"code": 500},
        )
    )
    mock_sdk_client.chat.completions.create = mock_chat_completions

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hello")],
    )

    with pytest.raises(LLMResponseError):
        await client.chat_completion(request)


@pytest.mark.asyncio
async def test_stream_error_handling() -> None:
    """Verify stream exception is mapped properly during iteration."""
    mock_sdk_client = MagicMock()
    mock_chat_completions = AsyncMock()
    mock_sdk_client.chat.completions.create = mock_chat_completions

    async def faulty_stream() -> AsyncIterator[ChatCompletionChunk]:
        yield ChatCompletionChunk(
            id="chunk-1",
            choices=[
                ChunkChoice(
                    delta=ChoiceDelta(content="start"),
                    finish_reason=None,
                    index=0,
                )
            ],
            created=1677652288,
            model="openai/gpt-4o-mini",
            object="chat.completion.chunk",
        )
        raise openai.APIConnectionError(request=MagicMock())

    mock_chat_completions.return_value = faulty_stream()

    client = OrcaRouterClient(api_key="test-key", client=mock_sdk_client)
    request = ChatCompletionRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="Hi")],
    )

    chunks: list[ChatStreamChunk] = []
    with pytest.raises(LLMServiceError) as exc_info:
        async for chunk in client.stream_chat_completion(request):
            chunks.append(chunk)

    assert len(chunks) == 1
    assert "Orca Router connection error" in str(exc_info.value)
