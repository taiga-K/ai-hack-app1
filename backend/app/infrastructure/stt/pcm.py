"""PCM helpers used by STT adapters."""

import numpy as np

OPENAI_REALTIME_PCM_RATE = 24000


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
