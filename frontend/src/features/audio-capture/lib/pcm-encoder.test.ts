import assert from "node:assert";
import { describe, it } from "node:test";
import {
  calculateRMS,
  downsampleBuffer,
  interleaveAndEncodeTo16BitPCM,
} from "./pcm-encoder.ts";

describe("pcm-encoder", () => {
  it("downsamples from 48000 to 16000 accurately", () => {
    // 48000 / 16000 = 3:1 ratio
    const input = new Float32Array([1.0, 1.0, 1.0, 0.5, 0.5, 0.5]);
    const downsampled = downsampleBuffer(input, 48000, 16000);

    assert.strictEqual(downsampled.length, 2);
    assert.strictEqual(Math.round(downsampled[0] * 10) / 10, 1.0);
    assert.strictEqual(Math.round(downsampled[1] * 10) / 10, 0.5);
  });

  it("downsampleBuffer returns same if rates match", () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    const result = downsampleBuffer(input, 16000, 16000);
    assert.strictEqual(result, input);
  });

  it("interleaves stereo channels into 16-bit PCM little-endian buffer", () => {
    const left = new Float32Array([0.5, -0.5]); // Mic
    const right = new Float32Array([1.0, -1.0]); // Meet Tab Audio

    const pcmBuffer = interleaveAndEncodeTo16BitPCM(left, right);
    // 2 samples * 2 channels * 2 bytes = 8 bytes
    assert.strictEqual(pcmBuffer.byteLength, 8);

    const view = new DataView(pcmBuffer);
    // Sample 0, Left (Mic, 0.5 -> ~16383)
    const s0Left = view.getInt16(0, true);
    assert.ok(Math.abs(s0Left - 16383) <= 1);

    // Sample 0, Right (Tab, 1.0 -> 32767)
    const s0Right = view.getInt16(2, true);
    assert.strictEqual(s0Right, 32767);

    // Sample 1, Left (Mic, -0.5 -> -16384)
    const s1Left = view.getInt16(4, true);
    assert.strictEqual(s1Left, -16384);

    // Sample 1, Right (Tab, -1.0 -> -32768)
    const s1Right = view.getInt16(6, true);
    assert.strictEqual(s1Right, -32768);
  });

  it("calculates RMS volume levels properly", () => {
    const silent = new Float32Array([0, 0, 0, 0]);
    assert.strictEqual(calculateRMS(silent), 0);

    const active = new Float32Array([0.2, -0.2, 0.2, -0.2]);
    const vol = calculateRMS(active);
    assert.ok(vol > 0 && vol <= 1);
  });
});
