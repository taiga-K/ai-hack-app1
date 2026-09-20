"use client";

import { AdviceWhisper, type Advice } from "@/entities/advice";
import { ScrollArea } from "@/shared/ui";

export interface CopilotSidebarProps {
  adviceItems: Advice[];
  onCopied?: (question: string) => void;
}

export function CopilotSidebar({ adviceItems, onCopied }: CopilotSidebarProps) {
  return (
    <aside
      aria-label="こちらのささやき"
      className="flex h-full min-h-0 flex-col"
    >
      <h2 className="shrink-0 pb-2 text-sm font-medium">ささやき</h2>
      <ScrollArea className="min-h-0 flex-1">
        <div
          className="flex flex-col gap-5 py-1 pr-2"
          aria-live="polite"
          aria-relevant="additions"
        >
          {adviceItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              いまは、ささやくことがありません
            </p>
          ) : (
            adviceItems.map((item, index) => (
              <AdviceWhisper
                key={item.id}
                advice={item}
                appearDelayMs={index * 140}
                onCopied={onCopied}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
