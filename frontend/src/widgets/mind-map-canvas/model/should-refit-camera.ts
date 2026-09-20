export interface MindMapCameraRefitInput {
  hasNodes: boolean;
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
  if (!input.hasNodes || input.width < 8 || input.height < 8) {
    return false;
  }
  if (input.isFirstLayout || input.sizeChanged) {
    return true;
  }
  return input.nodesChanged && !input.userTookCamera;
}
