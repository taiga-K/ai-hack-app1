export interface MindMapLayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MindMapViewport {
  x: number;
  y: number;
  zoom: number;
}

export function viewportFromMindMapLayout(
  nodes: readonly MindMapLayoutBox[],
  paneWidth: number,
  paneHeight: number,
  padding: number,
  minZoom: number,
  maxZoom: number
): MindMapViewport | null {
  if (nodes.length === 0 || paneWidth < 8 || paneHeight < 8) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  const contentWidth = Math.max(maxX - minX, 1);
  const contentHeight = Math.max(maxY - minY, 1);
  const padX = paneWidth * padding;
  const padY = paneHeight * padding;
  const zoom = Math.min(
    maxZoom,
    Math.max(
      minZoom,
      Math.min(
        (paneWidth - padX * 2) / contentWidth,
        (paneHeight - padY * 2) / contentHeight
      )
    )
  );
  return {
    x: (paneWidth - contentWidth * zoom) / 2 - minX * zoom,
    y: (paneHeight - contentHeight * zoom) / 2 - minY * zoom,
    zoom,
  };
}
