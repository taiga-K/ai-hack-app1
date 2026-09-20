import type { BackTarget } from "./types";

export const COMPLETED_SUMMARY_QUERY = "summary";

function meetingSearchParams(
  target: BackTarget,
  includeCompletedSummary: boolean
): string {
  const params = new URLSearchParams();
  params.set("title", target.title);
  if (target.preview) {
    params.set("demo", "1");
  }
  if (includeCompletedSummary && target.hasCompletedSummary) {
    params.set(COMPLETED_SUMMARY_QUERY, "1");
  }
  return params.toString();
}

export function buildMeetingHref(target: BackTarget): string {
  return `/meetings/${target.meetingId}?${meetingSearchParams(target, true)}`;
}

export function buildDocumentHref(target: BackTarget): string {
  return `/meetings/${target.meetingId}/document?${meetingSearchParams(target, false)}`;
}

export function readCompletedSummaryQuery(value: string | undefined): boolean {
  return value === "1";
}
