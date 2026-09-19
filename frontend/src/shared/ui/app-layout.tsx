import * as React from "react";
import { ScrollArea } from "@/shared/ui";

export interface AppLayoutProps {
  children: React.ReactNode;
  header: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function AppLayout({ header, sidebar, children }: AppLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {header}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {sidebar && (
          <aside
            aria-label="Sidebar"
            className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
          >
            <ScrollArea className="h-full p-4">{sidebar}</ScrollArea>
          </aside>
        )}
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          <ScrollArea className="h-full">{children}</ScrollArea>
        </main>
      </div>
    </div>
  );
}
