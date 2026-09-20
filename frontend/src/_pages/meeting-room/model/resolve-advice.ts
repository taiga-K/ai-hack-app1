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

export interface AdviceUndoState<T extends { id: string } = { id: string }> {
  action: AdviceAction;
  item: T;
  from: "active" | "later";
}

export function captureAdviceUndo<T extends { id: string }>(
  lists: AdviceLists<T>,
  adviceId: string,
  action: AdviceAction
): AdviceUndoState<T> | null {
  const fromActive = takeAdvice(lists.active, adviceId);
  if (fromActive !== undefined) {
    return { action, item: fromActive, from: "active" };
  }
  const fromLater = takeAdvice(lists.later, adviceId);
  if (fromLater !== undefined) {
    return { action, item: fromLater, from: "later" };
  }
  return null;
}

export function undoAdviceAction<T extends { id: string }>(
  lists: AdviceLists<T>,
  undo: AdviceUndoState<T>
): AdviceLists<T> {
  switch (undo.action) {
    case "heard":
    case "unneeded":
      if (undo.from === "active") {
        return {
          active: [undo.item, ...withoutAdvice(lists.active, undo.item.id)],
          later: lists.later,
        };
      }
      return {
        active: lists.active,
        later: [undo.item, ...withoutAdvice(lists.later, undo.item.id)],
      };
    case "later":
      return {
        active: [undo.item, ...withoutAdvice(lists.active, undo.item.id)],
        later: withoutAdvice(lists.later, undo.item.id),
      };
    default: {
      const _exhaustiveCheck: never = undo.action;
      throw new Error(`Unhandled advice action: ${_exhaustiveCheck}`);
    }
  }
}

export function bindAdviceUndo(run: () => void): () => void {
  let consumed = false;
  return () => {
    if (consumed) {
      return;
    }
    consumed = true;
    run();
  };
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
