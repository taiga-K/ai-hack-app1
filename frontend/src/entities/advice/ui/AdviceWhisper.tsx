"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyTextToClipboard } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { getAdviceCategoryPresentation } from "../model/labels";
import type { Advice } from "../model/types";

export interface AdviceWhisperProps {
  advice: Advice;
  onCopied?: (question: string) => void;
}

export function AdviceWhisper({ advice, onCopied }: AdviceWhisperProps) {
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
    <article className="motion-safe:animate-cute-whisper relative">
      <span
        aria-hidden
        className="motion-safe:animate-cute-kira pointer-events-none absolute -top-1 right-4 size-3 rounded-full bg-primary"
      />
      <p className="text-[11px] font-medium text-ours">{category.badge}</p>
      <h3 className="mt-1 text-sm font-medium leading-snug">{advice.title}</h3>
      <p className="mt-2 text-sm leading-relaxed">{advice.suggestedQuestion}</p>
      <Button
        className="mt-3"
        size="sm"
        variant="secondary"
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <Check data-icon="inline-start" />
        ) : (
          <Copy data-icon="inline-start" />
        )}
        {copied ? "コピーしたよ" : "この質問をコピー"}
      </Button>
    </article>
  );
}
