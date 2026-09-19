import type { SpeakerId } from "@/shared/api";

export interface Utterance {
  id: string;
  meetingId: string;
  speaker: SpeakerId;
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  createdAt: string;
}
