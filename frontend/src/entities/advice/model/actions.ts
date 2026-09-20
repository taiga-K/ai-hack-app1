export const ADVICE_ACTIONS = ["heard", "unneeded", "later"] as const;

export type AdviceAction = (typeof ADVICE_ACTIONS)[number];

export const ADVICE_ACTION_LABELS: Record<AdviceAction, string> = {
  heard: "聞けた",
  unneeded: "不要",
  later: "あとで",
};

export const ACTIVE_ADVICE_ACTIONS: readonly AdviceAction[] = [
  "heard",
  "unneeded",
  "later",
];

export const LATER_ADVICE_ACTIONS: readonly AdviceAction[] = [
  "heard",
  "unneeded",
];

export function getAdviceActionLabel(action: AdviceAction): string {
  switch (action) {
    case "heard":
    case "unneeded":
    case "later":
      return ADVICE_ACTION_LABELS[action];
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled advice action: ${_exhaustiveCheck}`);
    }
  }
}

export function getAdviceActionVariant(
  action: AdviceAction
): "default" | "outline" | "ghost" {
  switch (action) {
    case "heard":
      return "default";
    case "unneeded":
      return "outline";
    case "later":
      return "ghost";
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled advice action: ${_exhaustiveCheck}`);
    }
  }
}
