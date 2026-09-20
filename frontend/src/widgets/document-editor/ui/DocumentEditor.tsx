"use client";

import { useRef, type ReactNode } from "react";
import { Columns2, Eye, FilePenLine } from "lucide-react";
import {
  Label,
  ScrollArea,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui";
import { cn } from "@/shared/lib";
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
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const splitRef = useRef<HTMLTextAreaElement>(null);

  function flushEditorValue() {
    const next =
      view === "split" ? splitRef.current?.value : sourceRef.current?.value;
    if (typeof next === "string" && next !== markdown) {
      onMarkdownChange(next);
    }
  }

  function handleMarkdownInput(next: string) {
    onMarkdownChange(next);
  }

  function handleViewChange(next: string[]) {
    flushEditorValue();
    const selected = next[0];
    if (
      selected === "preview" ||
      selected === "split" ||
      selected === "source"
    ) {
      onViewChange(selected);
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
      <div className="relative min-h-0 flex-1 bg-background">
        {view === "preview" ? (
          <ScrollArea className="h-full">
            <div className="px-1 py-6 sm:px-2">{preview}</div>
          </ScrollArea>
        ) : null}
        <div
          className={cn(
            "h-full",
            view === "source" ? "flex flex-col" : "hidden"
          )}
        >
          <Label htmlFor="requirements-markdown" className="sr-only">
            まとめの本文
          </Label>
          <Textarea
            ref={sourceRef}
            id="requirements-markdown"
            value={markdown}
            onChange={(event) => handleMarkdownInput(event.target.value)}
            onInput={(event) => handleMarkdownInput(event.currentTarget.value)}
            spellCheck={false}
            tabIndex={view === "source" ? 0 : -1}
            className="h-full min-h-0 flex-1 resize-none font-mono text-sm leading-relaxed field-sizing-fixed"
          />
        </div>
        <div
          className={cn(
            "h-full min-h-0 grid-cols-1 lg:grid-cols-2",
            view === "split" ? "grid" : "hidden"
          )}
        >
          <div className="flex min-h-0 flex-col lg:pr-6">
            <Label htmlFor="requirements-markdown-split" className="sr-only">
              まとめの本文
            </Label>
            <Textarea
              ref={splitRef}
              id="requirements-markdown-split"
              value={markdown}
              onChange={(event) => handleMarkdownInput(event.target.value)}
              onInput={(event) =>
                handleMarkdownInput(event.currentTarget.value)
              }
              spellCheck={false}
              tabIndex={view === "split" ? 0 : -1}
              className="h-full min-h-0 flex-1 resize-none font-mono text-sm leading-relaxed field-sizing-fixed"
            />
          </div>
          {view === "split" ? (
            <ScrollArea className="h-full min-h-64">
              <div className="px-1 py-6 lg:pl-6">{preview}</div>
            </ScrollArea>
          ) : null}
        </div>
      </div>
    </section>
  );
}
