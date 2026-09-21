import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  didMindMapPaneWidthChange,
  keepInViewForMindMapFit,
  shouldCommitMindMapCameraMemory,
  shouldDeferMindMapResizeFit,
  shouldRefitForPaneHeight,
  shouldRefitMindMapCamera,
} from "./should-refit-camera.ts";

const readyPane = {
  hasNodes: true,
  nodesInitialized: true,
  width: 640,
  height: 400,
} as const;

describe("shouldRefitMindMapCamera", () => {
  it("fits the first layout and later pane resizes while the camera is free", () => {
    assert.equal(
      shouldRefitMindMapCamera({
        ...readyPane,
        isFirstLayout: true,
        sizeChanged: false,
        nodesChanged: false,
        userTookCamera: false,
      }),
      true
    );
    assert.equal(
      shouldRefitMindMapCamera({
        ...readyPane,
        isFirstLayout: false,
        sizeChanged: true,
        nodesChanged: false,
        userTookCamera: false,
      }),
      true
    );
    assert.equal(
      shouldRefitMindMapCamera({
        ...readyPane,
        isFirstLayout: false,
        sizeChanged: true,
        nodesChanged: false,
        userTookCamera: true,
      }),
      false
    );
  });

  it("does not refit when ぜんぶ見る only returns the camera", () => {
    assert.equal(
      shouldRefitMindMapCamera({
        ...readyPane,
        isFirstLayout: false,
        sizeChanged: false,
        nodesChanged: false,
        userTookCamera: false,
      }),
      false
    );
  });

  it("refits growth only while the user has not taken the camera", () => {
    assert.equal(
      shouldRefitMindMapCamera({
        ...readyPane,
        isFirstLayout: false,
        sizeChanged: false,
        nodesChanged: true,
        userTookCamera: false,
      }),
      true
    );
    assert.equal(
      shouldRefitMindMapCamera({
        ...readyPane,
        isFirstLayout: false,
        sizeChanged: false,
        nodesChanged: true,
        userTookCamera: true,
      }),
      false
    );
  });

  it("does not fit an empty, unmeasured, or unreadably small pane", () => {
    assert.equal(
      shouldRefitMindMapCamera({
        hasNodes: false,
        nodesInitialized: true,
        width: 640,
        height: 400,
        isFirstLayout: true,
        sizeChanged: false,
        nodesChanged: false,
        userTookCamera: false,
      }),
      false
    );
    assert.equal(
      shouldRefitMindMapCamera({
        ...readyPane,
        nodesInitialized: false,
        isFirstLayout: true,
        sizeChanged: false,
        nodesChanged: false,
        userTookCamera: false,
      }),
      false
    );
    assert.equal(
      shouldRefitMindMapCamera({
        hasNodes: true,
        nodesInitialized: true,
        width: 4,
        height: 400,
        isFirstLayout: true,
        sizeChanged: false,
        nodesChanged: false,
        userTookCamera: false,
      }),
      false
    );
  });
});

describe("shouldDeferMindMapResizeFit", () => {
  it("waits only for a settled size change", () => {
    assert.equal(
      shouldDeferMindMapResizeFit({
        sizeChanged: true,
        isFirstLayout: false,
        nodesChanged: false,
      }),
      true
    );
    assert.equal(
      shouldDeferMindMapResizeFit({
        sizeChanged: true,
        isFirstLayout: true,
        nodesChanged: false,
      }),
      false
    );
    assert.equal(
      shouldDeferMindMapResizeFit({
        sizeChanged: false,
        isFirstLayout: false,
        nodesChanged: true,
      }),
      false
    );
  });
});

describe("shouldCommitMindMapCameraMemory", () => {
  it("does not consume growth while nodes are still measuring", () => {
    assert.equal(
      shouldCommitMindMapCameraMemory({
        fitRan: false,
        nodesInitialized: false,
        userTookCamera: false,
      }),
      false
    );
    assert.equal(
      shouldCommitMindMapCameraMemory({
        fitRan: true,
        nodesInitialized: true,
        userTookCamera: false,
      }),
      true
    );
    assert.equal(
      shouldCommitMindMapCameraMemory({
        fitRan: false,
        nodesInitialized: true,
        userTookCamera: true,
      }),
      true
    );
  });
});

describe("didMindMapPaneWidthChange", () => {
  it("ignores a height-only shrink from the branch detail pane", () => {
    assert.equal(didMindMapPaneWidthChange(640, 500), true);
    assert.equal(didMindMapPaneWidthChange(640, 640), false);
    assert.equal(didMindMapPaneWidthChange(0, 640), false);
  });
});

describe("shouldRefitForPaneHeight", () => {
  it("refits a height-only change when the tree fits or a node anchors it", () => {
    assert.equal(
      shouldRefitForPaneHeight({
        heightChanged: true,
        overflows: false,
        hasAnchor: false,
      }),
      true
    );
    assert.equal(
      shouldRefitForPaneHeight({
        heightChanged: true,
        overflows: true,
        hasAnchor: true,
      }),
      true
    );
  });

  it("leaves an overflowing map alone when とじる clears the selection", () => {
    assert.equal(
      shouldRefitForPaneHeight({
        heightChanged: true,
        overflows: true,
        hasAnchor: false,
      }),
      false
    );
    assert.equal(
      shouldRefitForPaneHeight({
        heightChanged: false,
        overflows: false,
        hasAnchor: true,
      }),
      false
    );
  });
});

describe("keepInViewForMindMapFit", () => {
  const selected = { id: "scope" };

  it("drops the selected node on first layout and on ぜんぶ見る", () => {
    assert.equal(
      keepInViewForMindMapFit({
        isFirstLayout: true,
        resetToFullTree: false,
        keepInView: selected,
      }),
      null
    );
    assert.equal(
      keepInViewForMindMapFit({
        isFirstLayout: false,
        resetToFullTree: true,
        keepInView: selected,
      }),
      null
    );
  });

  it("keeps the pressed node only for a later resize fit", () => {
    assert.equal(
      keepInViewForMindMapFit({
        isFirstLayout: false,
        resetToFullTree: false,
        keepInView: selected,
      }),
      selected
    );
  });
});
