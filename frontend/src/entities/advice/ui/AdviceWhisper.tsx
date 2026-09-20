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
  onCopied?: (question: string) => void;
}

export function AdviceWhisper({
  advice,
  appearDelayMs = 0,
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
      className="motion-safe:animate-cute-whisper"
      style={{ animationDelay: `${String(appearDelayMs)}ms` }}
    >
      <p className="text-xs font-medium text-ours">{category.badge}</p>
      <p className="mt-2 text-base leading-relaxed font-medium">
        {advice.suggestedQuestion}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{advice.title}</p>
      <Button
        className="mt-2"
        size="sm"
        variant="ghost"
        onClick={() => void handleCopy()}
      >
        {copied ? <Check data-icon="inline-start" /> : null}
        {copied ? "コピーしました" : "コピー"}
      </Button>
    </article>
  );
}
