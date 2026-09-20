import { SideCluster } from "./SideCluster";

export interface MeetingFloorProps {
  oursListening: boolean;
  theirsListening: boolean;
  oursSpeaking: boolean;
  theirsSpeaking: boolean;
  oursVolume: number;
  theirsVolume: number;
  side?: "ours" | "theirs";
}

export function MeetingFloor({
  oursListening,
  theirsListening,
  oursSpeaking,
  theirsSpeaking,
  oursVolume,
  theirsVolume,
  side,
}: MeetingFloorProps) {
  const showOurs = side !== "theirs";
  const showTheirs = side !== "ours";

  return (
    <div
      className={
        showOurs && showTheirs
          ? "relative grid grid-cols-2 gap-6"
          : "relative min-w-0"
      }
    >
      {showOurs ? (
        <span
          aria-hidden
          className="motion-safe:animate-cute-breathe pointer-events-none absolute top-1 left-2 size-10 rounded-full bg-ours/10"
        />
      ) : null}
      {showTheirs ? (
        <span
          aria-hidden
          className="motion-safe:animate-cute-breathe pointer-events-none absolute top-0 right-8 size-8 rounded-full bg-theirs/10 [animation-delay:1.2s]"
        />
      ) : null}
      {showOurs ? (
        <SideCluster
          side="ours"
          listening={oursListening}
          speaking={oursSpeaking}
          volume={oursVolume}
        />
      ) : null}
      {showTheirs ? (
        <SideCluster
          side="theirs"
          listening={theirsListening}
          speaking={theirsSpeaking}
          volume={theirsVolume}
        />
      ) : null}
    </div>
  );
}
