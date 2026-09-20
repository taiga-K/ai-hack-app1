import type { AfterFinalizeDecision, AfterReadyPauseDecision } from "./types";

export function decideAfterFinalize(
  stayedOnFloor: boolean
): AfterFinalizeDecision {
  return stayedOnFloor ? "stay-on-floor" : "announce-ready";
}

export function decideAfterReadyPause(
  stayedOnFloor: boolean
): AfterReadyPauseDecision {
  return stayedOnFloor ? "stay-on-floor" : "open-document";
}
