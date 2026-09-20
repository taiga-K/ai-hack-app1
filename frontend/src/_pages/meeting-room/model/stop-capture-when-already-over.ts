import type { MeetingPhase } from "@/entities/meeting";

export function stopCaptureWhenAlreadyOver(
  alreadyOver: boolean,
  phase: MeetingPhase,
  stopCapture: () => void
): void {
  if (!alreadyOver) {
    return;
  }
  if (phase === "finalizing" || phase === "ended") {
    return;
  }
  stopCapture();
}
