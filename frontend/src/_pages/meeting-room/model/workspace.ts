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

export function mindMapPlaceLabel(
  nodes: readonly { label: string; parentId: string | null }[]
): string | null {
  if (nodes.length === 0) {
    return null;
  }
  const root = nodes.find((node) => node.parentId === null) ?? nodes[0];
  return root.label;
}
