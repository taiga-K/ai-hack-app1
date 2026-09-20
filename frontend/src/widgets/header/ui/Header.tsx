export interface HeaderProps {
  title?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function Header({
  title = "会議のまとめ",
  badge,
  actions,
}: HeaderProps) {
  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-5 py-3 sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-heading text-base font-medium tracking-tight text-foreground">
          {title}
        </span>
        {badge ? (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-secondary-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
