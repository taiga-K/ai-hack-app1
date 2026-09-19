/**
 * Downsamples Float32Array audio data from sourceSampleRate to targetSampleRate (e.g., 16000Hz)
 * using linear interpolation.
 */
export function downsampleBuffer(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return input;
  }
  if (sourceSampleRate < targetSampleRate) {
    // Upsampling not expected, return input
    return input;
  }

  const sampleRatio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(input.length / sampleRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Interleaves two mono 16kHz Float32 arrays into a stereo 16-bit PCM Int16Array ArrayBuffer.
 * Channel 0 (Left): mic (自社PM)
 * Channel 1 (Right): tab (Meet相手)
 */
export function interleaveAndEncodeTo16BitPCM(
  left: Float32Array,
  right: Float32Array
): ArrayBuffer {
  const length = Math.min(left.length, right.length);
  const buffer = new ArrayBuffer(length * 2 * 2); // length * 2 channels * 2 bytes (16-bit)
  const view = new DataView(buffer);

  let offset = 0;
  for (let i = 0; i < length; i++) {
    // Channel 0: Left (Mic)
    const sLeft = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(
      offset,
      sLeft < 0 ? sLeft * 0x8000 : sLeft * 0x7fff,
      true // little-endian
    );
    offset += 2;

    // Channel 1: Right (Tab Audio)
    const sRight = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(
      offset,
      sRight < 0 ? sRight * 0x8000 : sRight * 0x7fff,
      true // little-endian
    );
    offset += 2;
  }

  return buffer;
}

/**
 * Computes root mean square (RMS) volume level between 0 and 1.
 */
export function calculateRMS(data: Float32Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  const rms = Math.sqrt(sum / data.length);
  return Math.min(1, rms * 5); // Scale slightly for visual meter responsiveness
}
