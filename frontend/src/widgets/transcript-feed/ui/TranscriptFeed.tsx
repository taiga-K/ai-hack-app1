"use client";

import { useEffect, useRef } from "react";
import { MessageSquareText } from "lucide-react";
import { UtteranceBubble, type Utterance } from "@/entities/utterance";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  ScrollArea,
} from "@/shared/ui";

export interface TranscriptFeedProps {
  utterances: Utterance[];
}

export function TranscriptFeed({ utterances }: TranscriptFeedProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [utterances]);

  return (
    <section
      aria-label="リアルタイム文字起こし"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-medium">文字起こし</h2>
        <p className="text-[11px] text-muted-foreground">
          自社PMとクライアントを左右で区別
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {utterances.length === 0 ? (
          <div className="flex h-full min-h-64 items-center justify-center p-6">
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareText />
                </EmptyMedia>
                <EmptyTitle>まだ発話がありません</EmptyTitle>
                <EmptyDescription>
                  キャプチャを開始すると、Meetの会話がここにリアルタイム表示されます。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-4">
            {utterances.map((utterance) => (
              <UtteranceBubble key={utterance.id} utterance={utterance} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>
    </section>
  );
}
