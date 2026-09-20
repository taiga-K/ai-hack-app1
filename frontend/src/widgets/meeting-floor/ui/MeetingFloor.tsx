import { SideCluster } from "./SideCluster";

export interface MeetingFloorProps {
  oursListening: boolean;
  theirsListening: boolean;
  oursSpeaking: boolean;
  theirsSpeaking: boolean;
  oursVolume: number;
  theirsVolume: number;
}

export function MeetingFloor({
  oursListening,
  theirsListening,
  oursSpeaking,
  theirsSpeaking,
  oursVolume,
  theirsVolume,
}: MeetingFloorProps) {
  return (
    <div className="relative grid grid-cols-2 gap-6">
      <span
        aria-hidden
        className="motion-safe:animate-cute-breathe pointer-events-none absolute top-1 left-2 size-10 rounded-full bg-ours/10"
      />
      <span
        aria-hidden
        className="motion-safe:animate-cute-breathe pointer-events-none absolute top-0 right-8 size-8 rounded-full bg-theirs/10 [animation-delay:1.2s]"
      />
      <SideCluster
        side="ours"
        listening={oursListening}
        speaking={oursSpeaking}
        volume={oursVolume}
      />
      <SideCluster
        side="theirs"
        listening={theirsListening}
        speaking={theirsSpeaking}
        volume={theirsVolume}
      />
    </div>
  );
}
