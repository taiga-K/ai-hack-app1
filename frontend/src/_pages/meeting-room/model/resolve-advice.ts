import type { AdviceAction } from "@/entities/advice";

export interface AdviceLists<T extends { id: string } = { id: string }> {
  active: T[];
  later: T[];
}

function withoutAdvice<T extends { id: string }>(
  items: T[],
  adviceId: string
): T[] {
  return items.filter((item) => item.id !== adviceId);
}

function takeAdvice<T extends { id: string }>(
  items: T[],
  adviceId: string
): T | undefined {
  return items.find((item) => item.id === adviceId);
}

export function applyAdviceAction<T extends { id: string }>(
  lists: AdviceLists<T>,
  adviceId: string,
  action: AdviceAction
): AdviceLists<T> {
  switch (action) {
    case "heard":
    case "unneeded":
      return {
        active: withoutAdvice(lists.active, adviceId),
        later: withoutAdvice(lists.later, adviceId),
      };
    case "later": {
      const fromActive = takeAdvice(lists.active, adviceId);
      if (fromActive !== undefined) {
        return {
          active: withoutAdvice(lists.active, adviceId),
          later: [fromActive, ...withoutAdvice(lists.later, adviceId)],
        };
      }
      return lists;
    }
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled advice action: ${_exhaustiveCheck}`);
    }
  }
}

export function collectSeenAdviceIds(
  active: readonly { id: string }[],
  later: readonly { id: string }[],
  resolvedIds: readonly string[]
): Set<string> {
  return new Set([
    ...active.map((item) => item.id),
    ...later.map((item) => item.id),
    ...resolvedIds,
  ]);
}
