"use client";

import { useState } from "react";
import { AdviceWhisper, type Advice } from "@/entities/advice";
import { ScrollArea } from "@/shared/ui";

export interface CopilotSidebarProps {
  adviceItems: Advice[];
  onCopied?: (question: string) => void;
}

interface WhisperMotion {
  enter: boolean;
  delayMs: number;
}

function createInitialMotion(
  adviceItems: Advice[]
): ReadonlyMap<string, WhisperMotion> {
  return new Map(
    adviceItems.map((item) => [item.id, { enter: false, delayMs: 0 }])
  );
}

function mergeNewWhisperMotion(
  current: ReadonlyMap<string, WhisperMotion>,
  adviceItems: Advice[]
): ReadonlyMap<string, WhisperMotion> {
  let changed = false;
  const next = new Map(current);
  let stagger = 0;
  for (const item of adviceItems) {
    if (!next.has(item.id)) {
      next.set(item.id, { enter: true, delayMs: stagger * 140 });
      stagger += 1;
      changed = true;
    }
  }
  return changed ? next : current;
}

export function CopilotSidebar({ adviceItems, onCopied }: CopilotSidebarProps) {
  const [motionById, setMotionById] = useState(() =>
    createInitialMotion(adviceItems)
  );
  const resolvedMotion = mergeNewWhisperMotion(motionById, adviceItems);
  if (resolvedMotion !== motionById) {
    setMotionById(resolvedMotion);
  }

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
            adviceItems.map((item, index) => {
              const motion = resolvedMotion.get(item.id) ?? {
                enter: true,
                delayMs: index * 140,
              };
              return (
                <AdviceWhisper
                  key={item.id}
                  advice={item}
                  appearDelayMs={motion.delayMs}
                  enterMotion={motion.enter}
                  onCopied={onCopied}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
