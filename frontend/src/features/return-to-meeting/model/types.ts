export type AfterEndScreen = "making" | "ready" | "document";

export type BackTarget = {
  kind: "meeting";
  meetingId: string;
  title: string;
  preview: boolean;
  hasCompletedSummary?: boolean;
};

export type AfterFinalizeDecision = "stay-on-floor" | "announce-ready";

export type AfterReadyPauseDecision = "stay-on-floor" | "open-document";
