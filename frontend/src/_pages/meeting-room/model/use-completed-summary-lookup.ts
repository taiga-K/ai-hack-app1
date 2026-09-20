"use client";

import { useEffect, useState } from "react";
import { getRequirementDocument } from "@/entities/requirement-doc";
import {
  buildDocumentHref,
  forgetCompletedSummary,
  lookupCompletedSummary,
  mergeCompletedSummaryLookup,
  rememberCompletedSummary,
  resolveImmediateCompletedSummary,
  useRememberedCompletedSummary,
  type BackTarget,
  type CompletedSummaryLookup,
} from "@/features/return-to-meeting";

export function useCompletedSummaryLookup(
  target: BackTarget,
  completedSummaryHint: boolean
): CompletedSummaryLookup {
  const rememberedHref = useRememberedCompletedSummary(target.meetingId);
  const hintedHref = buildDocumentHref({
    ...target,
    hasCompletedSummary: true,
  });
  const immediate = resolveImmediateCompletedSummary({
    completedSummaryHint,
    rememberedHref,
    hintedHref,
    unverifiedLiveMeeting:
      !target.preview && !completedSummaryHint && rememberedHref === null,
  });
  const [fetched, setFetched] = useState<CompletedSummaryLookup | null>(null);

  useEffect(() => {
    if (target.preview) {
      return;
    }

    let cancelled = false;
    const lookupTarget: BackTarget = {
      kind: "meeting",
      meetingId: target.meetingId,
      title: target.title,
      preview: false,
    };
    void lookupCompletedSummary(
      lookupTarget.meetingId,
      hintedHref,
      getRequirementDocument
    ).then((next) => {
      if (cancelled) {
        return;
      }
      if (next.status === "found") {
        rememberCompletedSummary(lookupTarget, next.href);
      }
      if (next.status === "missing") {
        forgetCompletedSummary(lookupTarget.meetingId);
      }
      setFetched(next);
    });
    return () => {
      cancelled = true;
    };
  }, [hintedHref, target.meetingId, target.preview, target.title]);

  return mergeCompletedSummaryLookup(immediate, fetched);
}
