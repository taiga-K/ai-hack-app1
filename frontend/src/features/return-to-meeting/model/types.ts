export type AfterEndScreen = "making" | "ready" | "document";

export type AfterEndHandoff = "none" | "making" | "ready";

export type CompletedSummaryStatus = "checking" | "found" | "missing" | "error";

export type CompletedSummaryLookup =
  | { status: "checking" }
  | { status: "found"; href: string }
  | { status: "missing" }
  | { status: "error" };

export type BackTarget = {
  kind: "meeting";
  meetingId: string;
  title: string;
  preview: boolean;
  hasCompletedSummary?: boolean;
};

export type AfterEndNavigation = "open-document" | "stay-put";
