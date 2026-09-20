"use client";

import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "cn";

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-6 cursor-col-resize items-center justify-center bg-foreground/10 ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-6 after:-translate-x-1/2 hover:bg-foreground/16 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-6 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-6 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-16 w-6 shrink-0 flex-col items-center justify-center gap-1 rounded-full border border-foreground/25 bg-background text-foreground shadow-sm">
          <span aria-hidden className="text-[10px] leading-none font-medium">
            幅
          </span>
          <span aria-hidden className="flex flex-col gap-0.5">
            <span className="h-0.5 w-2.5 rounded-full bg-foreground/70" />
            <span className="h-0.5 w-2.5 rounded-full bg-foreground/70" />
            <span className="h-0.5 w-2.5 rounded-full bg-foreground/70" />
          </span>
        </div>
      ) : null}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
