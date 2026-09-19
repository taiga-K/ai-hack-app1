"use client";

import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isOpenIssuesHeading } from "@/entities/requirement-doc";
import { cn } from "@/shared/lib";

function headingText(children: ReactNode): string {
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(headingText).join("");
  }
  return "";
}

const markdownComponents: Components = {
  h2({ children, className, ...props }) {
    const text = headingText(children);
    const isOpenIssues = isOpenIssuesHeading(text);
    return (
      <h2
        className={cn(
          className,
          isOpenIssues &&
            "rounded-md border border-border bg-accent px-2 py-1.5 text-accent-foreground"
        )}
        {...props}
      >
        {children}
      </h2>
    );
  },
};

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
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </Markdown>
    </div>
  );
}
