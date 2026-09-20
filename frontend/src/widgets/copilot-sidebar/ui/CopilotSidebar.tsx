"use client";

import { useState } from "react";
import { AdviceWhisper, type Advice } from "@/entities/advice";
import {
  AdviceResolveActions,
  type AdviceResolveAction,
} from "@/features/resolve-advice";
import { ScrollArea } from "@/shared/ui";

export interface CopilotSidebarProps {
  adviceItems: Advice[];
  laterAdviceItems?: Advice[];
  onResolve?: (id: string, action: AdviceResolveAction) => void;
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

function AdviceList({
  adviceItems,
  later,
  motionById,
  onResolve,
}: {
  adviceItems: Advice[];
  later: boolean;
  motionById: ReadonlyMap<string, WhisperMotion>;
  onResolve?: (id: string, action: AdviceResolveAction) => void;
}) {
  return (
    <>
      {adviceItems.map((item, index) => {
        const motion = motionById.get(item.id) ?? {
          enter: true,
          delayMs: index * 140,
        };
        return (
          <AdviceWhisper
            key={item.id}
            advice={item}
            appearDelayMs={motion.delayMs}
            enterMotion={motion.enter}
            actions={
              onResolve ? (
                <AdviceResolveActions
                  later={later}
                  onResolve={(action) => onResolve(item.id, action)}
                />
              ) : null
            }
          />
        );
      })}
    </>
  );
}

export function CopilotSidebar({
  adviceItems,
  laterAdviceItems = [],
  onResolve,
}: CopilotSidebarProps) {
  const [motionById, setMotionById] = useState(() =>
    createInitialMotion([...adviceItems, ...laterAdviceItems])
  );
  const resolvedMotion = mergeNewWhisperMotion(motionById, [
    ...adviceItems,
    ...laterAdviceItems,
  ]);
  if (resolvedMotion !== motionById) {
    setMotionById(resolvedMotion);
  }

  const empty = adviceItems.length === 0 && laterAdviceItems.length === 0;

  return (
    <aside
      aria-label="こちらのアドバイス"
      className="flex h-full min-h-0 flex-col"
    >
      <h2 className="shrink-0 pb-2 text-sm font-medium">アドバイス</h2>
      <ScrollArea className="min-h-0 flex-1">
        <div
          className="flex flex-col gap-5 py-1 pr-2"
          aria-live="polite"
          aria-relevant="additions"
        >
          {empty ? (
            <p className="text-sm text-muted-foreground">
              いまは、アドバイスがありません
            </p>
          ) : (
            <>
              <AdviceList
                adviceItems={adviceItems}
                later={false}
                motionById={resolvedMotion}
                onResolve={onResolve}
              />
              {laterAdviceItems.length > 0 ? (
                <section aria-label="あとで聞く">
                  <h3 className="pb-3 text-sm font-medium text-muted-foreground">
                    あとで聞く
                  </h3>
                  <div className="flex flex-col gap-5">
                    <AdviceList
                      adviceItems={laterAdviceItems}
                      later
                      motionById={resolvedMotion}
                      onResolve={onResolve}
                    />
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
