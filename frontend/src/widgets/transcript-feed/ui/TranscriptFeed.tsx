"use client";

import { useEffect, useRef } from "react";
import { UtteranceLogLine, type Utterance } from "@/entities/utterance";
import { ScrollArea } from "@/shared/ui";

export interface TranscriptFeedProps {
  utterances: Utterance[];
}

export function TranscriptFeed({ utterances }: TranscriptFeedProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [utterances]);

  return (
    <section aria-label="会議のメモ" className="flex h-full min-h-0 flex-col">
      <h2 className="shrink-0 px-1 pb-2 text-sm font-medium">会議のメモ</h2>
      <ScrollArea className="min-h-0 flex-1">
        {utterances.length === 0 ? (
          <p className="px-1 py-8 text-sm text-muted-foreground">
            まだ、だれも話していません
          </p>
        ) : (
          <div className="divide-y divide-border/60 px-1">
            {utterances.map((utterance) => (
              <UtteranceLogLine key={utterance.id} utterance={utterance} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>
    </section>
  );
}
