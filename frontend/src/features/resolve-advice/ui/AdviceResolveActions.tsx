"use client";

import { Button } from "@/shared/ui";
import type { AdviceResolveAction } from "../model/types";

export interface AdviceResolveActionsProps {
  later?: boolean;
  onResolve: (action: AdviceResolveAction) => void;
}

export function AdviceResolveActions({
  later = false,
  onResolve,
}: AdviceResolveActionsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => onResolve("heard")}>
        聞けた
      </Button>
      {later ? null : (
        <Button size="sm" variant="outline" onClick={() => onResolve("later")}>
          あとで
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => onResolve("unneeded")}>
        不要
      </Button>
    </div>
  );
}
