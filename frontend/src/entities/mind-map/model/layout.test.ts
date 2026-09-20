import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layoutMindMap } from "./layout.ts";

describe("layoutMindMap", () => {
  it("places children below the root and draws parent links", () => {
    const layout = layoutMindMap([
      {
        id: "root",
        label: "今日の会議",
        parentId: null,
        sourceUtteranceIds: [],
      },
      {
        id: "scope",
        label: "対象範囲",
        parentId: "root",
        sourceUtteranceIds: ["utt-1"],
      },
      {
        id: "due",
        label: "納期",
        parentId: "root",
        sourceUtteranceIds: ["utt-2"],
      },
    ]);

    const root = layout.nodes.find((node) => node.id === "root");
    const scope = layout.nodes.find((node) => node.id === "scope");
    const due = layout.nodes.find((node) => node.id === "due");

    assert.ok(root);
    assert.ok(scope);
    assert.ok(due);
    assert.equal(root.depth, 0);
    assert.equal(scope.depth, 1);
    assert.equal(due.depth, 1);
    assert.ok(scope.y > root.y);
    assert.notEqual(scope.x, due.x);
    assert.equal(layout.edges.length, 2);
  });
});
