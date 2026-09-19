export { DualAudioCaptureService } from "./lib/audio-capture-service";
export { AudioWebSocketClient } from "./lib/audio-websocket-client";
export {
  calculateRMS,
  downsampleBuffer,
  interleaveAndEncodeTo16BitPCM,
} from "./lib/pcm-encoder";
export { useAudioCapture } from "./lib/use-audio-capture";
export type {
  AudioCaptureState,
  AudioCaptureStatus,
  AudioStreamStats,
  DualStreamResult,
  WebSocketStatus,
} from "./model/types";
export { AudioCaptureControl } from "./ui/AudioCaptureControl";
