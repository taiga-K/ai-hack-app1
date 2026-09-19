export type AudioCaptureStatus =
  "idle" | "requesting_permission" | "capturing" | "error";

export type WebSocketStatus =
  "disconnected" | "connecting" | "connected" | "error";

export interface AudioCaptureState {
  status: AudioCaptureStatus;
  wsStatus: WebSocketStatus;
  isRecording: boolean;
  hasPermission: boolean;
  hasMicStream: boolean;
  hasTabStream: boolean;
  micVolume: number;
  tabVolume: number;
  errorMessage: string | null;
}

export interface DualStreamResult {
  micStream: MediaStream;
  tabStream: MediaStream;
}

export interface AudioStreamStats {
  bytesSent: number;
  chunksSent: number;
  sampleRate: number;
}
