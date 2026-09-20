import { cn } from "@/shared/lib";

export interface SideClusterProps {
  side: "ours" | "theirs";
  listening: boolean;
  speaking: boolean;
  volume: number;
}

export function SideCluster({
  side,
  listening,
  speaking,
  volume,
}: SideClusterProps) {
  const label = side === "ours" ? "こちら" : "むこう";
  const showVoice = listening && volume > 0.05;
  const voiceWidth = `${Math.min(100, volume * 100)}%`;

  let status = "";
  if (listening && speaking) {
    status = "はなしてる";
  } else if (listening) {
    status = "きいている";
  }

  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-1.5 px-1">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className={cn(
            "text-lg font-medium tracking-tight",
            speaking &&
              "motion-safe:[animation:cute-glow_1.6s_ease-in-out_infinite]"
          )}
        >
          {label}
        </h2>
        {status ? (
          <p className="text-xs font-medium text-foreground">{status}</p>
        ) : null}
      </div>
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
