"""Unit tests for ChannelDiarizer."""

import numpy as np
import pytest

from app.domain.exceptions import AudioProcessingError
from app.domain.models.transcript import AudioChannel, Speaker
from app.infrastructure.audio.channel_diarizer import ChannelDiarizer


def test_channel_diarizer_demux_normal() -> None:
    diarizer = ChannelDiarizer(sample_rate=16000)
    assert diarizer.sample_rate == 16000

    # 4 samples: 2 samples per channel
    # Left channel: [100, 200], Right channel: [-100, -200]
    # Interleaved: [100, -100, 200, -200]
    stereo_samples = np.array([100, -100, 200, -200], dtype=np.int16)
    pcm_bytes = stereo_samples.tobytes()

    left_chunk, right_chunk = diarizer.demux_stereo_pcm(pcm_bytes, timestamp_ms=500)

    assert left_chunk.speaker == Speaker.LOCAL_PM
    assert left_chunk.channel == AudioChannel.LEFT
    assert left_chunk.sample_rate == 16000
    assert left_chunk.timestamp_ms == 500

    left_samples = np.frombuffer(left_chunk.data, dtype=np.int16)
    assert np.array_equal(left_samples, np.array([100, 200], dtype=np.int16))

    assert right_chunk.speaker == Speaker.REMOTE_CLIENT
    assert right_chunk.channel == AudioChannel.RIGHT
    assert right_chunk.sample_rate == 16000
    assert right_chunk.timestamp_ms == 500

    right_samples = np.frombuffer(right_chunk.data, dtype=np.int16)
    assert np.array_equal(right_samples, np.array([-100, -200], dtype=np.int16))


def test_channel_diarizer_empty() -> None:
    diarizer = ChannelDiarizer(sample_rate=16000)
    left_chunk, right_chunk = diarizer.demux_stereo_pcm(b"", timestamp_ms=0)
    assert left_chunk.data == b""
    assert right_chunk.data == b""
    assert left_chunk.speaker == Speaker.LOCAL_PM
    assert right_chunk.speaker == Speaker.REMOTE_CLIENT


def test_channel_diarizer_invalid_alignment() -> None:
    diarizer = ChannelDiarizer(sample_rate=16000)
    # 5 bytes is not a multiple of 4
    with pytest.raises(AudioProcessingError):
        diarizer.demux_stereo_pcm(b"12345")
