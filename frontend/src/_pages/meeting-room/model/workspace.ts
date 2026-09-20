export const MEETING_SPLIT = {
  leftDefault: "38",
  leftMin: "28",
  leftMax: "62",
} as const;

export const WORKSPACE_TABS = ["map", "notes"] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export const MOBILE_PANES = ["map", "notes", "whispers"] as const;
export type MobilePane = (typeof MOBILE_PANES)[number];

export function isWorkspaceTab(value: string): value is WorkspaceTab {
  return value === "map" || value === "notes";
}

export type MobileSidePane = Exclude<MobilePane, "map">;

export function isMobileSidePane(pane: MobilePane): pane is MobileSidePane {
  return pane === "notes" || pane === "whispers";
}
