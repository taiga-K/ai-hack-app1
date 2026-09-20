import { SideCluster } from "./SideCluster";

export interface MeetingFloorProps {
  oursListening: boolean;
  theirsListening: boolean;
  oursVolume: number;
  theirsVolume: number;
  side?: "ours" | "theirs";
}

export function MeetingFloor({
  oursListening,
  theirsListening,
  oursVolume,
  theirsVolume,
  side,
}: MeetingFloorProps) {
  const showOurs = side !== "theirs";
  const showTheirs = side !== "ours";

  return (
    <div
      className={showOurs && showTheirs ? "grid grid-cols-2 gap-6" : "min-w-0"}
    >
      {showOurs ? (
        <SideCluster
          side="ours"
          listening={oursListening}
          volume={oursVolume}
        />
      ) : null}
      {showTheirs ? (
        <SideCluster
          side="theirs"
          listening={theirsListening}
          volume={theirsVolume}
        />
      ) : null}
    </div>
  );
}
