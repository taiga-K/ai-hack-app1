import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-none border-0 bg-transparent px-0 py-2 text-base shadow-none transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-0 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
