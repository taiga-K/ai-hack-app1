import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layoutMindMap, measureMindMapLabel } from "./layout.ts";

describe("layoutMindMap", () => {
  it("places children to the right of the root and draws parent links", () => {
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
    assert.ok(scope.x > root.x + root.width);
    assert.ok(due.x > root.x + root.width);
    assert.notEqual(scope.y, due.y);
    assert.equal(layout.edges.length, 2);
  });

  it("keeps a compact tree left-to-right like the full map", () => {
    const layout = layoutMindMap(
      [
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
      ],
      { compact: true }
    );

    const root = layout.nodes.find((node) => node.id === "root");
    const scope = layout.nodes.find((node) => node.id === "scope");
    const due = layout.nodes.find((node) => node.id === "due");

    assert.ok(root);
    assert.ok(scope);
    assert.ok(due);
    assert.equal(root.x, 0);
    assert.ok(scope.x > root.x + root.width);
    assert.ok(due.x > root.x + root.width);
    assert.notEqual(scope.y, due.y);
    assert.ok(root.width >= 88);
    assert.ok(root.height >= 36);
  });

  it("gives a long Japanese label enough room instead of a fixed pill", () => {
    const longLabel = "既存顧客向けの更新申請だけと考えてよいですか";
    const box = measureMindMapLabel(longLabel);
    assert.ok(box.width > 160);
    assert.ok(box.height > 36);
    const layout = layoutMindMap([
      {
        id: "root",
        label: longLabel,
        parentId: null,
        sourceUtteranceIds: [],
      },
    ]);
    assert.equal(layout.nodes[0]?.width, box.width);
    assert.equal(layout.nodes[0]?.height, box.height);
  });
});
