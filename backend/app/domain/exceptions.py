"""Domain exceptions."""


class DomainException(Exception):
    """Base domain exception."""


class STTServiceError(DomainException):
    """Base exception for Speech-to-Text service failures."""


class STTConfigurationError(STTServiceError):
    """Configuration error for STT (missing key or unimplemented provider)."""


class AudioProcessingError(DomainException):
    """Audio chunk processing error (e.g. invalid PCM format)."""


class LLMServiceError(DomainException):
    """Base exception for LLM service failures."""


class LLMConfigurationError(LLMServiceError):
    """Configuration error for LLM Gateway (e.g. missing API key)."""


class LLMAuthenticationError(LLMServiceError):
    """Authentication failed when communicating with LLM Gateway."""


class LLMRateLimitError(LLMServiceError):
    """Rate limit reached on LLM Gateway."""


class LLMTimeoutError(LLMServiceError):
    """Timeout communicating with LLM Gateway."""


class LLMResponseError(LLMServiceError):
    """Invalid response received from LLM Gateway."""


class MeetingNotFoundError(DomainException):
    """Meeting session was not found."""


class MeetingHasNoTranscriptError(DomainException):
    """Cannot finalize a meeting without transcribed utterances."""


class RequirementsDocNotFoundError(DomainException):
    """Requirements document has not been generated for the meeting."""


class RequirementsDocGenerationError(DomainException):
    """Failed to generate a valid requirements document."""
