"use client";

import { BellRing } from "lucide-react";
import { AdviceCard, type Advice } from "@/entities/advice";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  ScrollArea,
} from "@/shared/ui";

export interface CopilotSidebarProps {
  adviceItems: Advice[];
  onCopied?: (question: string) => void;
}

export function CopilotSidebar({ adviceItems, onCopied }: CopilotSidebarProps) {
  return (
    <aside
      aria-label="自社PM向け助言"
      className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <div className="flex flex-col gap-1 border-b border-sidebar-border px-4 py-2.5">
        <h2 className="text-sm font-medium">リアルタイム助言</h2>
        <p className="text-[11px] text-muted-foreground">
          横からピコーン。Meet本体には表示されません。
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div
          className="flex flex-col gap-3 p-3"
          aria-live="polite"
          aria-relevant="additions"
        >
          {adviceItems.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellRing />
                </EmptyMedia>
                <EmptyTitle>助言はまだありません</EmptyTitle>
                <EmptyDescription>
                  曖昧・矛盾・無理・専門用語の取り違えを検出すると、ここに質問候補がスライドインします。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            adviceItems.map((item) => (
              <AdviceCard key={item.id} advice={item} onCopied={onCopied} />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
