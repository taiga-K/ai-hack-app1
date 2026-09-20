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

function overflowAxis(
  min: number,
  contentSize: number,
  paneSize: number,
  pad: number,
  zoom: number,
  overflows: boolean,
  keep: MindMapLayoutBox | null,
  axis: "x" | "y"
): number {
  if (!overflows) {
    return (paneSize - contentSize * zoom) / 2 - min * zoom;
  }
  const rooted = pad - min * zoom;
  if (keep === null) {
    return rooted;
  }
  const start = (axis === "x" ? keep.x : keep.y) * zoom + rooted;
  const size = (axis === "x" ? keep.width : keep.height) * zoom;
  const end = start + size;
  const viewEnd = paneSize - pad;
  let shift = 0;
  if (end > viewEnd) {
    shift -= end - viewEnd;
  }
  if (start + shift < pad) {
    shift += pad - (start + shift);
  }
  return rooted + shift;
}

export function viewportFromMindMapLayout(
  nodes: readonly MindMapLayoutBox[],
  paneWidth: number,
  paneHeight: number,
  padding: number,
  minZoom: number,
  maxZoom: number,
  keepInView: MindMapLayoutBox | null = null
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
  const overflowsX = contentWidth * zoom > paneWidth - padX * 2;
  const overflowsY = contentHeight * zoom > paneHeight - padY * 2;
  return {
    x: overflowAxis(
      minX,
      contentWidth,
      paneWidth,
      padX,
      zoom,
      overflowsX,
      keepInView,
      "x"
    ),
    y: overflowAxis(
      minY,
      contentHeight,
      paneHeight,
      padY,
      zoom,
      overflowsY,
      keepInView,
      "y"
    ),
    zoom,
  };
}
