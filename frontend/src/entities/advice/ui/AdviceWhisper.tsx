"use client";

import type { ReactNode } from "react";
import { getAdviceCategoryPresentation } from "../model/labels";
import type { Advice } from "../model/types";

export interface AdviceWhisperProps {
  advice: Advice;
  appearDelayMs?: number;
  enterMotion?: boolean;
  actions?: ReactNode;
}

export function AdviceWhisper({
  advice,
  appearDelayMs = 0,
  enterMotion = false,
  actions,
}: AdviceWhisperProps) {
  const category = getAdviceCategoryPresentation(advice.category);

  return (
    <article
      className={enterMotion ? "motion-safe:animate-cute-whisper" : undefined}
      style={
        enterMotion
          ? { animationDelay: `${String(appearDelayMs)}ms` }
          : undefined
      }
    >
      <p className="text-base leading-relaxed font-medium text-foreground">
        {advice.suggestedQuestion}
      </p>
      {actions}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-muted-foreground">
          くわしく
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-xs font-medium text-ours">{category.badge}</p>
          <p className="text-sm text-foreground">{advice.title}</p>
          <p className="text-sm leading-relaxed text-foreground">
            {advice.reason}
          </p>
        </div>
      </details>
    </article>
  );
}
