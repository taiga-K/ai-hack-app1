import type { ReactNode } from "react";

export interface HeaderProps {
  title?: string;
  badge?: string;
  leading?: ReactNode;
  titleActions?: ReactNode;
  actions?: ReactNode;
}

export function Header({
  title = "会議のまとめ",
  badge,
  leading,
  titleActions,
  actions,
}: HeaderProps) {
  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-5 py-3 sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <span className="truncate font-heading text-base font-medium tracking-tight text-foreground">
          {title}
        </span>
        {badge ? (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-secondary-foreground">
            {badge}
          </span>
        ) : null}
        {titleActions ? (
          <div className="flex shrink-0 items-center gap-1">{titleActions}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
