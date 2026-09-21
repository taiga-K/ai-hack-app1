import type { AfterEndHandoff, AfterEndNavigation } from "./types";

export const SHOW_STOP_WAITING_AFTER_MS = 8_000;

export function decideAfterEndNavigation(
  stillOnMeetingPage: boolean
): AfterEndNavigation {
  return stillOnMeetingPage ? "open-document" : "stay-put";
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
