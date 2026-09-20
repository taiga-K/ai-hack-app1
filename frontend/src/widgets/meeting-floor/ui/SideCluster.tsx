import { cn } from "@/shared/lib";

export interface SideClusterProps {
  side: "ours" | "theirs";
  listening: boolean;
  volume: number;
}

export function SideCluster({ side, listening, volume }: SideClusterProps) {
  const label = side === "ours" ? "こちら" : "むこう";
  const showVoice = listening && volume > 0.05;
  const voiceWidth = `${Math.min(100, volume * 100)}%`;

  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-1.5 px-1">
      {showVoice ? (
        <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-150",
              side === "ours" ? "bg-ours" : "bg-theirs"
            )}
            style={{ width: voiceWidth }}
          />
        </div>
      ) : null}
    </section>
  );
}
