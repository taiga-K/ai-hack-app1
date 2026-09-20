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
    <div className="grid grid-cols-2 gap-6">
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
