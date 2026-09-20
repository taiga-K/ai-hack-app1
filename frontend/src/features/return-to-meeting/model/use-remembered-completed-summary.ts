"use client";

import { useSyncExternalStore } from "react";
import { readRememberedCompletedSummary } from "./completed-summary";

function subscribeRememberedCompletedSummary(): () => void {
  return () => undefined;
}

export function useRememberedCompletedSummary(
  meetingId: string
): string | null {
  return useSyncExternalStore(
    subscribeRememberedCompletedSummary,
    () => readRememberedCompletedSummary(meetingId),
    () => null
  );
}
