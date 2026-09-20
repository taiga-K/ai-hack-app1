"use client";

import { Button } from "@/shared/ui";
import {
  ACTIVE_ADVICE_ACTIONS,
  getAdviceActionLabel,
  getAdviceActionVariant,
  type AdviceAction,
} from "../model/actions";
import { getAdviceCategoryPresentation } from "../model/labels";
import type { Advice } from "../model/types";

export interface AdviceWhisperProps {
  advice: Advice;
  appearDelayMs?: number;
  enterMotion?: boolean;
  availableActions?: readonly AdviceAction[];
  onAction?: (adviceId: string, action: AdviceAction) => void;
}

export function AdviceWhisper({
  advice,
  appearDelayMs = 0,
  enterMotion = false,
  availableActions = ACTIVE_ADVICE_ACTIONS,
  onAction,
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
      <p className="text-xs font-medium text-ours">{category.badge}</p>
      <p className="mt-2 text-base leading-relaxed font-medium text-foreground">
        {advice.suggestedQuestion}
      </p>
      <p className="mt-2 text-sm text-foreground">{advice.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        {advice.reason}
      </p>
      {onAction !== undefined && availableActions.length > 0 ? (
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="このアドバイスの操作"
        >
          {availableActions.map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={getAdviceActionVariant(action)}
              onClick={() => {
                onAction(advice.id, action);
              }}
            >
              {getAdviceActionLabel(action)}
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
