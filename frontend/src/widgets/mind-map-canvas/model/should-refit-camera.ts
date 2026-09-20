export interface MindMapCameraRefitInput {
  hasNodes: boolean;
  nodesInitialized: boolean;
  width: number;
  height: number;
  isFirstLayout: boolean;
  sizeChanged: boolean;
  nodesChanged: boolean;
  userTookCamera: boolean;
}

export function shouldRefitMindMapCamera(
  input: MindMapCameraRefitInput
): boolean {
  if (
    !input.hasNodes ||
    !input.nodesInitialized ||
    input.width < 8 ||
    input.height < 8
  ) {
    return false;
  }
  // A stacked/LR flip clears the first-fit flag. The old pan is in dead space.
  if (input.userTookCamera && !input.isFirstLayout) {
    return false;
  }
  return input.isFirstLayout || input.sizeChanged || input.nodesChanged;
}

export function shouldDeferMindMapResizeFit(input: {
  sizeChanged: boolean;
  isFirstLayout: boolean;
  nodesChanged: boolean;
}): boolean {
  return input.sizeChanged && !input.isFirstLayout && !input.nodesChanged;
}

export function usesStackedMindMapLayout(
  width: number,
  compact: boolean
): boolean {
  if (compact) {
    return true;
  }
  return width > 0 && width < 560;
}

/** A pan is only kept for the stacked/wide layout that the user actually moved. */
export function mindMapCameraLayoutKey(
  compact: boolean,
  stacked: boolean
): string {
  return `${compact ? "c" : "f"}:${stacked ? "tb" : "lr"}`;
}

export function didUserTakeMindMapCamera(
  takenLayoutKey: string | null,
  layoutKey: string
): boolean {
  return takenLayoutKey === layoutKey;
}

/** Snapshot growth only. Expand/collapse must not look like new nodes. */
export function mindMapGrowthSignature(
  revision: number,
  nodeIds: readonly string[]
): string {
  return `${String(revision)}:${nodeIds.join(",")}`;
}

/** Splitter drags change the width; the branch detail only changes the height. */
export function didMindMapPaneWidthChange(
  previousWidth: number,
  nextWidth: number
): boolean {
  return previousWidth > 0 && Math.abs(previousWidth - nextWidth) > 2;
}

/** Memo/advice on a phone shrinks the peek a lot; BranchDetail does not. */
export const MIND_MAP_HEIGHT_REFIT_PX = 200;

export function didMindMapPaneHeightRefit(
  previousHeight: number,
  nextHeight: number
): boolean {
  return (
    previousHeight > 0 &&
    Math.abs(previousHeight - nextHeight) > MIND_MAP_HEIGHT_REFIT_PX
  );
}

export function shouldCommitMindMapCameraMemory(input: {
  fitRan: boolean;
  nodesInitialized: boolean;
  userTookCamera: boolean;
}): boolean {
  if (!input.nodesInitialized) {
    return false;
  }
  return input.fitRan || input.userTookCamera;
}
