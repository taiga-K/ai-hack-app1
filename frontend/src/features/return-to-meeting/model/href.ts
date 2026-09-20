import type { BackTarget } from "./types";

function meetingSearchParams(target: BackTarget): string {
  const params = new URLSearchParams();
  params.set("title", target.title);
  if (target.preview) {
    params.set("demo", "1");
  }
  return params.toString();
}

export function buildMeetingHref(target: BackTarget): string {
  return `/meetings/${target.meetingId}?${meetingSearchParams(target)}`;
}

export function buildDocumentHref(target: BackTarget): string {
  return `/meetings/${target.meetingId}/document?${meetingSearchParams(target)}`;
}
