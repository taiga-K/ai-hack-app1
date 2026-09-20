import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { viewportFromMindMapLayout } from "./viewport-from-layout.ts";

describe("viewportFromMindMapLayout", () => {
  it("fits a parent and child into the pane instead of one node", () => {
    const viewport = viewportFromMindMapLayout(
      [
        { x: 0, y: 0, width: 160, height: 36 },
        { x: 0, y: 76, width: 160, height: 36 },
        { x: 200, y: 76, width: 160, height: 36 },
      ],
      640,
      400,
      0.12,
      0.12,
      1.45
    );
    assert.ok(viewport);
    assert.ok(viewport.zoom <= 1.45);
    assert.ok(viewport.zoom >= 0.12);
    const left = 0 * viewport.zoom + viewport.x;
    const right = 360 * viewport.zoom + viewport.x;
    const top = 0 * viewport.zoom + viewport.y;
    const bottom = 112 * viewport.zoom + viewport.y;
    assert.ok(left >= -1);
    assert.ok(top >= -1);
    assert.ok(right <= 641);
    assert.ok(bottom <= 401);
  });

  it("returns null when the pane or tree is empty", () => {
    assert.equal(
      viewportFromMindMapLayout([], 640, 400, 0.12, 0.12, 1.45),
      null
    );
    assert.equal(
      viewportFromMindMapLayout(
        [{ x: 0, y: 0, width: 160, height: 36 }],
        4,
        400,
        0.12,
        0.12,
        1.45
      ),
      null
    );
  });
});
