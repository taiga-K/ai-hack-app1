"""PCM helpers used by STT adapters."""

import numpy as np

OPENAI_REALTIME_PCM_RATE = 24000
SPEECH_RMS_THRESHOLD = 350.0
TURN_SILENCE_MS = 800


def pcm16_rms(pcm16: bytes) -> float:
    """Root-mean-square of signed 16-bit little-endian mono PCM."""
    samples = np.frombuffer(pcm16, dtype="<i2")
    if samples.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(samples.astype(np.float64)))))


def pcm16_has_speech(pcm16: bytes, threshold: float = SPEECH_RMS_THRESHOLD) -> bool:
    """True when the chunk is loud enough to count as speech."""
    return pcm16_rms(pcm16) >= threshold


def pcm16_is_dominant(
    this_pcm16: bytes,
    other_pcm16: bytes,
    threshold: float = SPEECH_RMS_THRESHOLD,
) -> bool:
    """True when this channel is speaking and the other is not competing."""
    this_rms = pcm16_rms(this_pcm16)
    other_rms = pcm16_rms(other_pcm16)
    if this_rms < threshold:
        return False
    return this_rms >= other_rms * 2.0 or other_rms < threshold


class SpeechTurnTracker:
    """Detect the end of a spoken turn from local energy, not a wall clock."""

    def __init__(
        self,
        silence_ms: int = TURN_SILENCE_MS,
        speech_rms: float = SPEECH_RMS_THRESHOLD,
    ) -> None:
        self._silence_ms = silence_ms
        self._speech_rms = speech_rms
        self._heard_speech = False
        self._quiet_ms = 0

    def observe(self, pcm16: bytes, sample_rate: int) -> bool:
        """Return True once after speech followed by enough silence."""
        if sample_rate <= 0 or len(pcm16) < 2:
            return False
        duration_ms = int(round((len(pcm16) // 2) / sample_rate * 1000))
        if pcm16_rms(pcm16) >= self._speech_rms:
            self._heard_speech = True
            self._quiet_ms = 0
            return False
        if not self._heard_speech:
            return False
        self._quiet_ms += duration_ms
        if self._quiet_ms < self._silence_ms:
            return False
        self.reset()
        return True

    def reset(self) -> None:
        self._heard_speech = False
        self._quiet_ms = 0


def resample_pcm16_le(pcm16: bytes, source_rate: int, target_rate: int) -> bytes:
    """Resample mono signed 16-bit little-endian PCM with linear interpolation."""
    if source_rate <= 0 or target_rate <= 0:
        raise ValueError("sample rates must be positive")
    if source_rate == target_rate or len(pcm16) < 2:
        return pcm16

    samples = np.frombuffer(pcm16, dtype="<i2")
    if samples.size == 0:
        return b""

    target_length = max(1, int(round(samples.size * target_rate / source_rate)))
    source_x = np.linspace(0.0, 1.0, samples.size, endpoint=False)
    target_x = np.linspace(0.0, 1.0, target_length, endpoint=False)
    interpolated = np.interp(target_x, source_x, samples.astype(np.float64))
    return np.clip(np.rint(interpolated), -32768, 32767).astype("<i2").tobytes()
