import type { MeetingPhase } from "@/entities/meeting";
import type { CompletedSummaryStatus } from "@/features/return-to-meeting";

export function stopCaptureWhenAlreadyOver(
  lookupStatus: CompletedSummaryStatus,
  phase: MeetingPhase,
  stopCapture: () => void
): void {
  if (phase === "finalizing") {
    return;
  }
  switch (lookupStatus) {
    case "found":
      stopCapture();
      return;
    case "checking":
    case "error":
    case "missing":
      if (phase === "ended") {
        stopCapture();
      }
      return;
    default: {
      const _exhaustiveCheck: never = lookupStatus;
      throw new Error(`Unhandled lookup status: ${_exhaustiveCheck}`);
    }
  }
}
