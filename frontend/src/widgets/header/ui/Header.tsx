import { Badge } from "@/shared/ui";

export interface HeaderProps {
  title?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function Header({
  title = "AI HACK APP1",
  badge = "Copilot",
  actions,
}: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2.5">
        <span className="font-sans text-sm font-semibold tracking-tight text-foreground">
          {title}
        </span>
        {badge && (
          <Badge variant="secondary" className="text-[11px] font-normal">
            {badge}
          </Badge>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
