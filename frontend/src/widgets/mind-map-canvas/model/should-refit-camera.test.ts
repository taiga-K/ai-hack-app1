import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  didMindMapPaneWidthChange,
  mindMapGrowthSignature,
  shouldCommitMindMapCameraMemory,
  shouldDeferMindMapResizeFit,
  shouldPinMindMapDecisions,
  shouldRefitMindMapCamera,
  usesStackedMindMapLayout,
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

describe("usesStackedMindMapLayout", () => {
  it("stacks a compact or narrow pane so children stay readable", () => {
    assert.equal(usesStackedMindMapLayout(800, true), true);
    assert.equal(usesStackedMindMapLayout(400, false), true);
    assert.equal(usesStackedMindMapLayout(700, false), false);
    assert.equal(usesStackedMindMapLayout(0, false), false);
  });
});

describe("shouldPinMindMapDecisions", () => {
  it("matches the stacked tree so pills and branch detail agree", () => {
    assert.equal(shouldPinMindMapDecisions(800, false), true);
    assert.equal(shouldPinMindMapDecisions(400, false), false);
    assert.equal(shouldPinMindMapDecisions(800, true), false);
    assert.equal(shouldPinMindMapDecisions(0, false), true);
  });
});

describe("mindMapGrowthSignature", () => {
  it("stays stable when only the visible branch changes", () => {
    const snapshotIds = ["root", "scope", "release", "homework"];
    assert.equal(
      mindMapGrowthSignature(3, snapshotIds),
      mindMapGrowthSignature(3, snapshotIds)
    );
    assert.notEqual(
      mindMapGrowthSignature(3, snapshotIds),
      mindMapGrowthSignature(4, snapshotIds)
    );
    assert.notEqual(
      mindMapGrowthSignature(3, ["root", "scope"]),
      mindMapGrowthSignature(3, snapshotIds)
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
