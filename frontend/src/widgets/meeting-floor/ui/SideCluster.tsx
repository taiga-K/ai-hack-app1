import { cn } from "@/shared/lib";

const SEAT_COUNT = 5;

export interface SideClusterProps {
  side: "ours" | "theirs";
  speaking: boolean;
  volume: number;
}

export function SideCluster({ side, speaking, volume }: SideClusterProps) {
  const label = side === "ours" ? "こちら" : "むこう";
  const glowWidth = `${Math.min(100, Math.max(12, volume * 100))}%`;

  return (
    <section
      aria-label={label}
      className={cn(
        "flex min-w-0 flex-col gap-3 px-2 py-1",
        speaking && "motion-safe:animate-cute-pop"
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight">{label}</h2>
        <p className="text-[11px] text-muted-foreground">
          {speaking ? "はなしてる" : "きいてる"}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {Array.from({ length: SEAT_COUNT }, (_, index) => (
          <span
            key={`${side}-seat-${index}`}
            aria-hidden
            className={cn(
              "size-8 rounded-full sm:size-9",
              side === "ours" ? "bg-ours/35" : "bg-theirs/35",
              speaking &&
                index < 3 &&
                "motion-safe:[animation:cute-seat_1.1s_ease-in-out_infinite]"
            )}
            style={{ animationDelay: `${index * 90}ms` }}
          />
        ))}
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-150",
            side === "ours" ? "bg-ours" : "bg-theirs"
          )}
          style={{ width: glowWidth }}
        />
      </div>
    </section>
  );
}
