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
  if (input.userTookCamera) {
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

/** Pills, layout, and branch-detail counts share this flag. */
export function shouldPinMindMapDecisions(
  width: number,
  compact: boolean
): boolean {
  return !usesStackedMindMapLayout(width, compact);
}

/** Snapshot growth only. Expand/collapse must not look like new nodes. */
export function mindMapGrowthSignature(
  revision: number,
  nodeIds: readonly string[]
): string {
  return `${String(revision)}:${nodeIds.join(",")}`;
}

/** BranchDetail shrinking height must not steal the camera. */
export function didMindMapPaneWidthChange(
  previousWidth: number,
  nextWidth: number
): boolean {
  return previousWidth > 0 && Math.abs(previousWidth - nextWidth) > 2;
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
