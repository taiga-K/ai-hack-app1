import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MindMapNode } from "./types.ts";
import {
  layoutMindMap,
  measureMindMapLabel,
  type MindMapLayoutAlgorithm,
} from "./layout.ts";

const algorithms: MindMapLayoutAlgorithm[] = ["mindmap", "compactBox"];

const sampleNodes = [
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
] satisfies MindMapNode[];

const previewTree = [
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
    sourceUtteranceIds: ["preview-utt-1"],
  },
  {
    id: "api",
    label: "システムのつなぎ",
    parentId: "root",
    sourceUtteranceIds: ["preview-utt-2"],
  },
  {
    id: "renewal",
    label: "更新申請だけ",
    parentId: "scope",
    sourceUtteranceIds: ["preview-utt-1"],
  },
  {
    id: "sync",
    label: "すぐ反映したい",
    parentId: "api",
    sourceUtteranceIds: ["preview-utt-2"],
  },
  {
    id: "due",
    label: "来月末の本番",
    parentId: "root",
    sourceUtteranceIds: ["preview-utt-2"],
  },
  {
    id: "exceptions",
    label: "例外は宿題",
    parentId: "scope",
    sourceUtteranceIds: ["preview-utt-5", "preview-utt-6"],
  },
] satisfies MindMapNode[];

describe("layoutMindMap", () => {
  for (const algorithm of algorithms) {
    it(`places children to the right of the root with ${algorithm}`, () => {
      const layout = layoutMindMap(sampleNodes, { algorithm });
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
  }

  it("keeps a compact tree left-to-right like the full map", () => {
    const layout = layoutMindMap(sampleNodes, { compact: true });
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

  it("keeps the preview tree left-to-right without overlapping pills", () => {
    const layout = layoutMindMap(previewTree);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    const root = byId.get("root");
    const scope = byId.get("scope");
    const renewal = byId.get("renewal");

    assert.ok(root);
    assert.ok(scope);
    assert.ok(renewal);
    assert.ok(scope.x > root.x + root.width);
    assert.ok(renewal.x > scope.x + scope.width);
    assert.equal(layout.nodes.length, previewTree.length);

    for (let i = 0; i < layout.nodes.length; i += 1) {
      const a = layout.nodes[i];
      assert.ok(a);
      for (let j = i + 1; j < layout.nodes.length; j += 1) {
        const b = layout.nodes[j];
        assert.ok(b);
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        assert.equal(apart, true, `${a.id} overlaps ${b.id}`);
      }
    }
  });
});
