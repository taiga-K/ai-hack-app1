import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMindMapNode, type MindMapNode } from "./types.ts";
import {
  MIND_MAP_INITIAL_VISIBLE_DEPTH,
  computeMindMapDepths,
  resolveMindMapVisibility,
  selectedMindMapNode,
  toggleMindMapBranch,
} from "./visibility.ts";

const tree: MindMapNode[] = [
  createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
  createMindMapNode({ id: "budget", label: "予算", parentId: "root" }),
  createMindMapNode({ id: "release", label: "公開時期", parentId: "root" }),
  createMindMapNode({
    id: "budget-amount",
    label: "30万円",
    parentId: "budget",
    kind: "report",
  }),
  createMindMapNode({
    id: "budget-old",
    label: "20万円",
    parentId: "budget",
    kind: "report",
    status: "superseded",
  }),
  createMindMapNode({
    id: "release-plan",
    label: "来月末",
    parentId: "release",
    kind: "proposal",
  }),
  createMindMapNode({
    id: "release-decision",
    label: "来月末で決定",
    parentId: "release-plan",
    kind: "decision",
    status: "decided",
  }),
  createMindMapNode({
    id: "next-step",
    label: "見積もりを送る",
    parentId: "budget-amount",
    kind: "action",
  }),
  createMindMapNode({
    id: "deep-note",
    label: "細かい補足",
    parentId: "next-step",
  }),
];

describe("resolveMindMapVisibility", () => {
  it("starts shallow but keeps decisions and next actions in view", () => {
    assert.equal(MIND_MAP_INITIAL_VISIBLE_DEPTH, 2);
    const visibility = resolveMindMapVisibility(tree, new Set());
    const ids = visibility.visible.map((node) => node.id);

    assert.deepEqual(ids.slice(0, 3), ["root", "budget", "release"]);
    assert.deepEqual([...ids].sort(), [
      "budget",
      "budget-amount",
      "next-step",
      "release",
      "release-decision",
      "release-plan",
      "root",
    ]);
    assert.equal(visibility.hiddenChildCount.get("budget"), 1);
    assert.equal(visibility.hiddenChildCount.get("next-step"), 1);
    assert.equal(visibility.hiddenChildCount.has("release"), false);
    assert.equal(visibility.depthById.get("root"), 1);
    assert.equal(visibility.depthById.get("deep-note"), 5);
  });

  it("opens a branch, including corrected history, when it is expanded", () => {
    const expanded = toggleMindMapBranch(new Set(), "budget");
    const visibility = resolveMindMapVisibility(tree, expanded);
    const ids = visibility.visible.map((node) => node.id);

    assert.ok(ids.includes("budget-old"));
    assert.equal(visibility.hiddenChildCount.has("budget"), false);
    assert.equal(ids.includes("deep-note"), false);

    const closed = toggleMindMapBranch(expanded, "budget");
    assert.equal(closed.has("budget"), false);
  });

  it("starts flatter when decisions are not pinned (phones)", () => {
    const visibility = resolveMindMapVisibility(tree, new Set(), {
      pinDecisions: false,
    });
    assert.deepEqual(
      visibility.visible.map((node) => node.id),
      ["root", "budget", "release"]
    );
    assert.equal(visibility.hiddenChildCount.get("budget"), 2);
    assert.equal(visibility.hiddenChildCount.get("release"), 1);
  });

  it("does not show children of a hidden branch even if marked expanded", () => {
    const visibility = resolveMindMapVisibility(tree, new Set(["budget-old"]));
    const ids = visibility.visible.map((node) => node.id);
    assert.equal(ids.includes("budget-old"), false);
  });

  it("computes depths with the root as 1 and orphans as roots", () => {
    const depths = computeMindMapDepths([
      ...tree,
      createMindMapNode({ id: "lost", label: "親不明", parentId: "ghost" }),
    ]);
    assert.equal(depths.get("root"), 1);
    assert.equal(depths.get("budget"), 2);
    assert.equal(depths.get("next-step"), 4);
    assert.equal(depths.get("lost"), 1);
  });
});

describe("selectedMindMapNode", () => {
  it("drops a stale selection", () => {
    const [root, budget] = tree;
    assert.ok(root);
    assert.ok(budget);
    assert.equal(selectedMindMapNode([root], "budget"), null);
    assert.equal(selectedMindMapNode([root, budget], "budget"), budget);
    assert.equal(selectedMindMapNode([root], null), null);
  });
});
