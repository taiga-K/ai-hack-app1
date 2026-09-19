import { cn } from "@/shared/lib";
import {
  formatUtteranceClock,
  getSpeakerLabel,
  getSpeakerSide,
} from "../model/labels";
import type { Utterance } from "../model/types";

export interface UtteranceLogLineProps {
  utterance: Utterance;
}

export function UtteranceLogLine({ utterance }: UtteranceLogLineProps) {
  const side = getSpeakerSide(utterance.speaker);
  const label = getSpeakerLabel(utterance.speaker);

  return (
    <article
      className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-2.5"
      aria-label={`${label}の発言`}
    >
      <time
        className="pt-0.5 font-mono text-[11px] tracking-wide text-muted-foreground"
        dateTime={utterance.createdAt}
      >
        {formatUtteranceClock(utterance.startMs)}
      </time>
      <span
        className={cn(
          "mt-0.5 inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium",
          side === "ours" ? "bg-ours/20 text-ours" : "bg-theirs/20 text-theirs"
        )}
      >
        {label}
      </span>
      <p className="text-sm leading-relaxed text-foreground">
        {utterance.text}
        {!utterance.isFinal && (
          <span className="ml-2 text-[11px] text-muted-foreground">
            ききとり中
          </span>
        )}
      </p>
    </article>
  );
}
