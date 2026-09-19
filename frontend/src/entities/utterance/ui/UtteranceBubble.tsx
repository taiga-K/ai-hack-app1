import { Badge } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { formatUtteranceClock, getSpeakerLabel } from "../model/labels";
import type { Utterance } from "../model/types";

export interface UtteranceBubbleProps {
  utterance: Utterance;
}

export function UtteranceBubble({ utterance }: UtteranceBubbleProps) {
  const isLocalPm = utterance.speaker === "local_pm";

  return (
    <article
      className={cn(
        "flex w-full max-w-[92%] flex-col gap-1",
        isLocalPm ? "ml-auto items-end" : "mr-auto items-start"
      )}
      aria-label={`${getSpeakerLabel(utterance.speaker)}の発話`}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Badge variant={isLocalPm ? "default" : "secondary"}>
          {getSpeakerLabel(utterance.speaker)}
        </Badge>
        <time dateTime={utterance.createdAt}>
          {formatUtteranceClock(utterance.startMs)}
        </time>
        {!utterance.isFinal && <span>認識中</span>}
      </div>
      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-xs ring-1 ring-foreground/8",
          isLocalPm
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-card text-card-foreground"
        )}
      >
        {utterance.text}
      </div>
    </article>
  );
}
