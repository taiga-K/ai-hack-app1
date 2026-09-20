"use client";

import { useEffect, useState } from "react";
import {
  buildDocumentHref,
  fetchCompletedDocumentHref,
  type BackTarget,
} from "@/features/return-to-meeting";

export function useCompletedDocumentHref(
  target: BackTarget,
  hasCompletedSummaryQuery: boolean
): string | null {
  const queryHref = hasCompletedSummaryQuery ? buildDocumentHref(target) : null;
  const [fetchedHref, setFetchedHref] = useState<string | null>(null);

  useEffect(() => {
    if (hasCompletedSummaryQuery || target.preview) {
      return;
    }

    let cancelled = false;
    void fetchCompletedDocumentHref({
      kind: "meeting",
      meetingId: target.meetingId,
      title: target.title,
      preview: target.preview,
    }).then((next) => {
      if (!cancelled && next !== null) {
        setFetchedHref(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    hasCompletedSummaryQuery,
    target.meetingId,
    target.preview,
    target.title,
  ]);

  return queryHref ?? fetchedHref;
}
