"use client";

import type { ReactNode } from "react";
import { Columns2, Eye, FilePenLine } from "lucide-react";
import {
  Label,
  ScrollArea,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui";
import type { DocumentEditorView } from "../model/types";

export interface DocumentEditorProps {
  markdown: string;
  view: DocumentEditorView;
  onMarkdownChange: (markdown: string) => void;
  onViewChange: (view: DocumentEditorView) => void;
  preview: ReactNode;
}

export function DocumentEditor({
  markdown,
  view,
  onMarkdownChange,
  onViewChange,
  preview,
}: DocumentEditorProps) {
  function handleViewChange(next: string[]) {
    const selected = next[0];
    if (
      selected === "preview" ||
      selected === "split" ||
      selected === "source"
    ) {
      onViewChange(selected);
    }
  }

  let workspace: ReactNode;
  switch (view) {
    case "preview":
      workspace = (
        <ScrollArea className="h-full">
          <div className="px-6 py-6 sm:px-10">{preview}</div>
        </ScrollArea>
      );
      break;
    case "source":
      workspace = (
        <div className="flex h-full min-h-0 flex-col px-4 py-4">
          <Label htmlFor="requirements-markdown" className="sr-only">
            まとめの本文
          </Label>
          <Textarea
            id="requirements-markdown"
            value={markdown}
            onChange={(event) => onMarkdownChange(event.target.value)}
            spellCheck={false}
            className="h-full min-h-0 flex-1 resize-none font-mono text-sm leading-relaxed field-sizing-fixed"
          />
        </div>
      );
      break;
    case "split":
      workspace = (
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
            <Label htmlFor="requirements-markdown-split" className="sr-only">
              まとめの本文
            </Label>
            <Textarea
              id="requirements-markdown-split"
              value={markdown}
              onChange={(event) => onMarkdownChange(event.target.value)}
              spellCheck={false}
              className="h-full min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-sm leading-relaxed field-sizing-fixed"
            />
          </div>
          <ScrollArea className="h-full min-h-64">
            <div className="px-6 py-6">{preview}</div>
          </ScrollArea>
        </div>
      );
      break;
    default: {
      const _exhaustiveCheck: never = view;
      throw new Error(`Unhandled document editor view: ${_exhaustiveCheck}`);
    }
  }

  return (
    <section
      aria-label="要件定義書エディタ"
      className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 sm:px-8"
    >
      <div className="flex shrink-0 items-center justify-between py-2">
        <ToggleGroup
          value={[view]}
          onValueChange={handleViewChange}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="表示モード"
        >
          <ToggleGroupItem value="preview" aria-label="見る">
            <Eye data-icon="inline-start" />
            見る
          </ToggleGroupItem>
          <ToggleGroupItem value="split" aria-label="ならべて">
            <Columns2 data-icon="inline-start" />
            ならべて
          </ToggleGroupItem>
          <ToggleGroupItem value="source" aria-label="なおす">
            <FilePenLine data-icon="inline-start" />
            なおす
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="min-h-0 flex-1 bg-background">{workspace}</div>
    </section>
  );
}
