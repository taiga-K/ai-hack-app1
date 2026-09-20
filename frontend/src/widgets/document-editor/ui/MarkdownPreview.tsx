"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/shared/lib";

export interface MarkdownPreviewProps {
  markdown: string;
  className?: string;
}

export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  return (
    <div
      className={cn(
        "prose prose-neutral max-w-none text-foreground dark:prose-invert prose-headings:font-heading prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground",
        className
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </div>
  );
}
