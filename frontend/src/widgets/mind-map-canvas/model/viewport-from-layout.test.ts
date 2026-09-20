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

  it("pins the root when the zoom floor overflows and nothing is kept", () => {
    const root = { x: 0, y: 0, width: 160, height: 36 };
    const far = { x: 900, y: 0, width: 160, height: 36 };
    const viewport = viewportFromMindMapLayout(
      [root, far],
      320,
      200,
      0.12,
      0.85,
      1
    );
    assert.ok(viewport);
    assert.equal(viewport.zoom, 0.85);
    const rootLeft = root.x * viewport.zoom + viewport.x;
    assert.ok(Math.abs(rootLeft - 320 * 0.12) < 1);
    const farLeft = far.x * viewport.zoom + viewport.x;
    assert.ok(farLeft > 320);
  });

  it("keeps the pressed node in the pane on an overflowing fit", () => {
    const root = { x: 0, y: 0, width: 160, height: 36 };
    const far = { x: 900, y: 80, width: 160, height: 36 };
    const viewport = viewportFromMindMapLayout(
      [root, far],
      320,
      200,
      0.12,
      0.85,
      1,
      far
    );
    assert.ok(viewport);
    const left = far.x * viewport.zoom + viewport.x;
    const right = (far.x + far.width) * viewport.zoom + viewport.x;
    const top = far.y * viewport.zoom + viewport.y;
    const bottom = (far.y + far.height) * viewport.zoom + viewport.y;
    assert.ok(left >= 320 * 0.12 - 1);
    assert.ok(right <= 320 - 320 * 0.12 + 1);
    assert.ok(top >= 200 * 0.12 - 1);
    assert.ok(bottom <= 200 - 200 * 0.12 + 1);
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
