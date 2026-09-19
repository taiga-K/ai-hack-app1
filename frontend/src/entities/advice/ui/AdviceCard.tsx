"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { copyTextToClipboard } from "@/shared/lib";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui";
import {
  getAdviceCategoryPresentation,
  getAdvicePriorityLabel,
  getAdvicePriorityVariant,
} from "../model/labels";
import type { Advice } from "../model/types";

export interface AdviceCardProps {
  advice: Advice;
  onCopied?: (question: string) => void;
}

export function AdviceCard({ advice, onCopied }: AdviceCardProps) {
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
    <Card
      size="sm"
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
    >
      <CardHeader className="border-b">
        <CardTitle className="text-sm">{advice.title}</CardTitle>
        <CardDescription>自社PM画面のみに表示</CardDescription>
        <CardAction>
          <div className="flex flex-wrap justify-end gap-1">
            <Badge variant="outline">{category.badge}</Badge>
            <Badge variant={getAdvicePriorityVariant(advice.priority)}>
              優先度 {getAdvicePriorityLabel(advice.priority)}
            </Badge>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{advice.reason}</p>
        {advice.quote && (
          <blockquote className="rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
            「{advice.quote}」
          </blockquote>
        )}
        <p className="text-sm leading-relaxed">{advice.suggestedQuestion}</p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
          {copied ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied ? "コピー済み" : "質問文をコピー"}
        </Button>
      </CardFooter>
    </Card>
  );
}
