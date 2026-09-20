import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldRefitMindMapCamera } from "./should-refit-camera.ts";

const readyPane = {
  hasNodes: true,
  width: 640,
  height: 400,
} as const;

describe("shouldRefitMindMapCamera", () => {
  it("fits the first layout and later pane resizes", () => {
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
        userTookCamera: true,
      }),
      true
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

  it("does not fit an empty or unreadably small pane", () => {
    assert.equal(
      shouldRefitMindMapCamera({
        hasNodes: false,
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
        hasNodes: true,
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
