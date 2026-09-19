"""LLM Service domain port interface."""

from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable

from app.domain.models.llm import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatStreamChunk,
)


@runtime_checkable
class LLMService(Protocol):
    """Clean Architecture abstract domain port for LLM interactions.

    Any implementation (e.g. Orca Router Adapter) must adhere to this protocol.
    Domain/Application layers depend exclusively on this interface.
    """

    async def chat_completion(
        self,
        request: ChatCompletionRequest,
    ) -> ChatCompletionResponse:
        """Execute a non-streaming chat completion."""
        ...

    def stream_chat_completion(
        self,
        request: ChatCompletionRequest,
    ) -> AsyncIterator[ChatStreamChunk]:
        """Execute a streaming chat completion yielding content chunks."""
        ...
