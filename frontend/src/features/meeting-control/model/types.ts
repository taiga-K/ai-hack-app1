import type { MeetingPhase } from "@/entities/meeting";

export type MeetingWsStatus =
  "disconnected" | "connecting" | "connected" | "error";

export type MeetingCaptureStatus =
  "idle" | "requesting_permission" | "capturing" | "error";

export interface MeetingConnectionState {
  status: MeetingCaptureStatus;
  wsStatus: MeetingWsStatus;
  isRecording: boolean;
  hasMicStream: boolean;
  hasTabStream: boolean;
  micVolume: number;
  tabVolume: number;
  errorMessage: string | null;
}

export interface MeetingStreamStats {
  bytesSent: number;
  chunksSent: number;
  sampleRate: number;
}

export interface MeetingControlViewModel {
  phase: MeetingPhase;
  connection: MeetingConnectionState;
  stats: MeetingStreamStats;
  chimeEnabled: boolean;
}
