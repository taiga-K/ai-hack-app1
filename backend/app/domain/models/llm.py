"""Domain models for LLM interactions."""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ChatRole(StrEnum):
    """Chat message role."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


@dataclass(frozen=True)
class ChatMessage:
    """Represents a message in a chat completion conversation."""

    role: ChatRole
    content: str


@dataclass(frozen=True)
class TokenUsage:
    """Token usage metrics."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass(frozen=True)
class ChatCompletionRequest:
    """Request payload for chat completion."""

    messages: list[ChatMessage]
    model: str = "openai/gpt-4o-mini"
    fallback_models: list[str] = field(default_factory=list)
    temperature: float = 0.7
    max_tokens: int | None = None
    response_schema: dict[str, Any] | None = None


@dataclass(frozen=True)
class ChatCompletionResponse:
    """Response payload for non-streaming chat completion."""

    content: str
    model: str
    usage: TokenUsage | None = None
    finish_reason: str | None = None


@dataclass(frozen=True)
class ChatStreamChunk:
    """Individual streamed chunk of a chat completion."""

    delta_content: str
    model: str | None = None
    finish_reason: str | None = None
    usage: TokenUsage | None = None
