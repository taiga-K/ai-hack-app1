import type { AdviceResolveAction, AdviceResolveLists } from "./types";

function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

function findById<T extends { id: string }>(
  items: T[],
  id: string
): T | undefined {
  return items.find((item) => item.id === id);
}

export function applyAdviceResolve<T extends { id: string }>(
  lists: AdviceResolveLists<T>,
  id: string,
  action: AdviceResolveAction
): AdviceResolveLists<T> {
  const target = findById(lists.current, id) ?? findById(lists.later, id);
  if (target === undefined) {
    return lists;
  }

  const current = removeById(lists.current, id);
  const later = removeById(lists.later, id);

  switch (action) {
    case "heard":
    case "unneeded":
      return { current, later };
    case "later":
      return { current, later: [...later, target] };
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled advice resolve action: ${_exhaustiveCheck}`);
    }
  }
}
