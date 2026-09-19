import type { SpeakerId } from "@/shared/api";

export type SpeakerSide = "ours" | "theirs";

export function getSpeakerSide(speaker: SpeakerId): SpeakerSide {
  switch (speaker) {
    case "local_pm":
      return "ours";
    case "remote_client":
      return "theirs";
    default: {
      const _exhaustiveCheck: never = speaker;
      throw new Error(`Unhandled speaker: ${_exhaustiveCheck}`);
    }
  }
}

export function getSpeakerLabel(speaker: SpeakerId): string {
  const side = getSpeakerSide(speaker);
  switch (side) {
    case "ours":
      return "こちら";
    case "theirs":
      return "むこう";
    default: {
      const _exhaustiveCheck: never = side;
      throw new Error(`Unhandled speaker side: ${_exhaustiveCheck}`);
    }
  }
}

export function formatUtteranceClock(startMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
