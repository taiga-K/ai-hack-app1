import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMindMapNode, type MindMapNode } from "./types.ts";
import {
  layoutMindMap,
  measureMindMapLabel,
  type MindMapLayoutAlgorithm,
} from "./layout.ts";

const algorithms: MindMapLayoutAlgorithm[] = ["mindmap", "compactBox"];

const sampleNodes: MindMapNode[] = [
  createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
  createMindMapNode({
    id: "scope",
    label: "対象範囲",
    parentId: "root",
    sourceUtteranceIds: ["utt-1"],
  }),
  createMindMapNode({
    id: "due",
    label: "納期",
    parentId: "root",
    sourceUtteranceIds: ["utt-2"],
  }),
];

const previewTree: MindMapNode[] = [
  createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
  createMindMapNode({ id: "scope", label: "対象範囲", parentId: "root" }),
  createMindMapNode({ id: "api", label: "システムのつなぎ", parentId: "root" }),
  createMindMapNode({
    id: "renewal",
    label: "更新申請だけ",
    parentId: "scope",
    kind: "proposal",
  }),
  createMindMapNode({
    id: "sync",
    label: "すぐ反映したい",
    parentId: "api",
    kind: "report",
  }),
  createMindMapNode({ id: "due", label: "来月末の本番", parentId: "root" }),
  createMindMapNode({
    id: "exceptions",
    label: "例外は宿題",
    parentId: "scope",
    kind: "action",
  }),
];

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
      assert.deepEqual(
        layout.edges.map((edge) => edge.kind),
        ["tree", "tree"]
      );
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
      createMindMapNode({ id: "root", label: longLabel, parentId: null }),
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

  it("draws relation lines only where they add to the tree", () => {
    const layout = layoutMindMap([
      createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
      createMindMapNode({
        id: "inhouse",
        label: "内製で進める",
        parentId: "root",
        kind: "proposal",
      }),
      createMindMapNode({
        id: "outsource",
        label: "外注する",
        parentId: "root",
        kind: "proposal",
      }),
      createMindMapNode({
        id: "risk",
        label: "納期に間に合わない",
        parentId: "outsource",
        kind: "concern",
        relations: [
          { kind: "opposes", targetId: "outsource" },
          { kind: "supports", targetId: "inhouse" },
          { kind: "supports", targetId: "missing" },
        ],
      }),
    ]);

    const byId = new Map(layout.edges.map((edge) => [edge.id, edge]));
    assert.equal(byId.get("outsource-risk")?.kind, "opposes");
    assert.equal(byId.get("root-inhouse")?.kind, "tree");
    const cross = byId.get("supports-risk-inhouse");
    assert.ok(cross);
    assert.equal(cross.source, "risk");
    assert.equal(cross.target, "inhouse");
    assert.equal(cross.kind, "supports");
    assert.equal(layout.edges.length, 4);
  });
});
