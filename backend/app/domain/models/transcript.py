"""Audio and transcription domain models."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class Speaker(StrEnum):
    """Speaker identity derived from audio channel."""

    LOCAL_PM = "local_pm"
    REMOTE_CLIENT = "remote_client"


class AudioChannel(StrEnum):
    """Audio channel identifier."""

    LEFT = "left"  # local PM (microphone)
    RIGHT = "right"  # remote client (meet tab)


@dataclass(frozen=True)
class AudioChunk:
    """Raw PCM audio chunk associated with a speaker and channel."""

    speaker: Speaker
    channel: AudioChannel
    data: bytes
    sample_rate: int
    timestamp_ms: int


@dataclass(frozen=True)
class Utterance:
    """Transcribed speech utterance from a speaker."""

    id: str
    meeting_id: str
    speaker: Speaker
    text: str
    start_ms: int
    end_ms: int
    is_final: bool
    created_at: datetime
