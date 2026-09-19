export interface MeetingSession {
  id: string;
  title: string;
  createdAt: string;
}

export type MeetingPhase = "idle" | "live" | "ended";
