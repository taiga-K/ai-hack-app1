export const ADVICE_RESOLVE_ACTIONS = ["heard", "later", "unneeded"] as const;

export type AdviceResolveAction = (typeof ADVICE_RESOLVE_ACTIONS)[number];

export interface AdviceResolveLists<T extends { id: string }> {
  current: T[];
  later: T[];
}
