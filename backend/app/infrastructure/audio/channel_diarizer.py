"""Audio channel diarizer and demultiplexer."""

import numpy as np

from app.domain.exceptions import AudioProcessingError
from app.domain.models.transcript import AudioChannel, AudioChunk, Speaker


class ChannelDiarizer:
    """Demultiplexes stereo 2ch 16-bit PCM audio into Left and Right channels.

    Physical channel separation provides 100% deterministic speaker labeling:
    - Left channel (channel 0): local PM microphone
    - Right channel (channel 1): remote Meet tab audio
    """

    def __init__(self, sample_rate: int = 16000) -> None:
        self._sample_rate = sample_rate

    @property
    def sample_rate(self) -> int:
        return self._sample_rate

    def demux_stereo_pcm(
        self,
        pcm_bytes: bytes,
        timestamp_ms: int = 0,
    ) -> tuple[AudioChunk, AudioChunk]:
        """Split 16-bit stereo interleaved PCM bytes into mono AudioChunks.

        Args:
            pcm_bytes: Interleaved 16-bit signed PCM audio bytes.
            timestamp_ms: Starting timestamp of the audio chunk in milliseconds.

        Returns:
            Tuple of (left_chunk, right_chunk) for LOCAL_PM and REMOTE_CLIENT.

        Raises:
            AudioProcessingError: If byte length is not a multiple of 4.
        """
        if len(pcm_bytes) % 4 != 0:
            raise AudioProcessingError(
                f"Invalid stereo 16-bit PCM buffer length: {len(pcm_bytes)} bytes. "
                "Must be a multiple of 4 bytes (2 channels * 2 bytes per sample)."
            )

        if len(pcm_bytes) == 0:
            return (
                AudioChunk(
                    speaker=Speaker.LOCAL_PM,
                    channel=AudioChannel.LEFT,
                    data=b"",
                    sample_rate=self._sample_rate,
                    timestamp_ms=timestamp_ms,
                ),
                AudioChunk(
                    speaker=Speaker.REMOTE_CLIENT,
                    channel=AudioChannel.RIGHT,
                    data=b"",
                    sample_rate=self._sample_rate,
                    timestamp_ms=timestamp_ms,
                ),
            )

        # De-interleave 16-bit signed PCM
        stereo_array = np.frombuffer(pcm_bytes, dtype=np.int16).reshape(-1, 2)
        left_mono = stereo_array[:, 0].tobytes()
        right_mono = stereo_array[:, 1].tobytes()

        left_chunk = AudioChunk(
            speaker=Speaker.LOCAL_PM,
            channel=AudioChannel.LEFT,
            data=left_mono,
            sample_rate=self._sample_rate,
            timestamp_ms=timestamp_ms,
        )

        right_chunk = AudioChunk(
            speaker=Speaker.REMOTE_CLIENT,
            channel=AudioChannel.RIGHT,
            data=right_mono,
            sample_rate=self._sample_rate,
            timestamp_ms=timestamp_ms,
        )

        return left_chunk, right_chunk
