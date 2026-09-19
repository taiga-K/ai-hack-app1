import type { ReactNode } from "react";
import { SideCluster } from "./SideCluster";

export interface MeetingFloorProps {
  oursSpeaking: boolean;
  theirsSpeaking: boolean;
  oursVolume: number;
  theirsVolume: number;
  whispers: ReactNode;
}

export function MeetingFloor({
  oursSpeaking,
  theirsSpeaking,
  oursVolume,
  theirsVolume,
  whispers,
}: MeetingFloorProps) {
  return (
    <div className="grid min-h-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
      <div className="flex min-h-0 flex-col gap-4">
        <SideCluster side="ours" speaking={oursSpeaking} volume={oursVolume} />
        <div className="min-h-0 flex-1">{whispers}</div>
      </div>
      <SideCluster
        side="theirs"
        speaking={theirsSpeaking}
        volume={theirsVolume}
      />
    </div>
  );
}
