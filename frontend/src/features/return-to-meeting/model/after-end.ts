import type {
  AfterEndHandoff,
  AfterFinalizeDecision,
  AfterReadyPauseDecision,
} from "./types";

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

export function shouldShowAfterEndBack(handoff: AfterEndHandoff): boolean {
  switch (handoff) {
    case "none":
    case "making":
    case "ready":
      return false;
    default: {
      const _exhaustiveCheck: never = handoff;
      throw new Error(`Unhandled after-end handoff: ${_exhaustiveCheck}`);
    }
  }
}
