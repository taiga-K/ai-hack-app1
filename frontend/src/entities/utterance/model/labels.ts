import type { SpeakerId } from "@/shared/api";

export function getSpeakerLabel(speaker: SpeakerId): string {
  switch (speaker) {
    case "local_pm":
      return "自社PM";
    case "remote_client":
      return "クライアント";
    default: {
      const _exhaustiveCheck: never = speaker;
      throw new Error(`Unhandled speaker: ${_exhaustiveCheck}`);
    }
  }
}

export function formatUtteranceClock(startMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
