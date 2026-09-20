"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { copyTextToClipboard } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { getAdviceCategoryPresentation } from "../model/labels";
import type { Advice } from "../model/types";

export interface AdviceWhisperProps {
  advice: Advice;
  appearDelayMs?: number;
  enterMotion?: boolean;
  onCopied?: (question: string) => void;
}

export function AdviceWhisper({
  advice,
  appearDelayMs = 0,
  enterMotion = false,
  onCopied,
}: AdviceWhisperProps) {
  const [copied, setCopied] = useState(false);
  const category = getAdviceCategoryPresentation(advice.category);

  async function handleCopy() {
    const ok = await copyTextToClipboard(advice.suggestedQuestion);
    if (!ok) {
      return;
    }
    setCopied(true);
    onCopied?.(advice.suggestedQuestion);
    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

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
      <Button
        className="mt-2"
        size="sm"
        variant="outline"
        onClick={() => void handleCopy()}
      >
        {copied ? <Check data-icon="inline-start" /> : null}
        {copied ? "コピーしました" : "コピー"}
      </Button>
    </article>
  );
}
