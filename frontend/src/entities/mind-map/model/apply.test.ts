import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMindMapEvent } from "./apply.ts";
import { createEmptyMindMap, createMindMapNode } from "./types.ts";

describe("applyMindMapEvent", () => {
  it("applies upserts in revision order and ignores stale events", () => {
    const empty = createEmptyMindMap("m-1");
    const first = applyMindMapEvent(empty, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 1,
      upserts: [
        createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
      ],
      removes: [],
      pending: [],
    });
    const second = applyMindMapEvent(first, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
        createMindMapNode({
          id: "scope",
          label: "対象範囲",
          parentId: "root",
          sourceUtteranceIds: ["utt-1"],
        }),
      ],
      removes: [],
      pending: [{ text: "例外の扱い", sourceUtteranceIds: ["utt-1"] }],
    });
    const stale = applyMindMapEvent(second, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 1,
      upserts: [
        createMindMapNode({ id: "stale", label: "古い", parentId: null }),
      ],
      removes: ["scope"],
      pending: [],
    });

    assert.equal(first.revision, 1);
    assert.equal(second.nodes.length, 2);
    assert.deepEqual(second.pending, [
      { text: "例外の扱い", sourceUtteranceIds: ["utt-1"] },
    ]);
    assert.equal(stale.revision, 2);
    assert.equal(
      stale.nodes.some((node) => node.id === "scope"),
      true
    );
    assert.equal(
      stale.nodes.some((node) => node.id === "stale"),
      false
    );
    assert.equal(stale.pending.length, 1);
  });

  it("replaces a corrected node and resolves pending", () => {
    const current = applyMindMapEvent(createEmptyMindMap("m-1"), {
      type: "mindmap",
      meetingId: "m-1",
      revision: 1,
      upserts: [
        createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
        createMindMapNode({
          id: "budget",
          label: "予算は30万円",
          parentId: "root",
          kind: "report",
        }),
      ],
      removes: [],
      pending: [{ text: "交通費の扱い", sourceUtteranceIds: [] }],
    });
    const next = applyMindMapEvent(current, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
        createMindMapNode({
          id: "budget",
          label: "予算は40万円",
          parentId: "root",
          kind: "report",
          detail: "交通費も含む",
          history: ["予算は30万円"],
        }),
      ],
      removes: [],
      pending: [],
    });
    const other = applyMindMapEvent(next, {
      type: "mindmap",
      meetingId: "other",
      revision: 3,
      upserts: [
        createMindMapNode({ id: "x", label: "別会議", parentId: null }),
      ],
      removes: ["root"],
      pending: [],
    });

    const budget = next.nodes.find((node) => node.id === "budget");
    assert.ok(budget);
    assert.equal(budget.label, "予算は40万円");
    assert.deepEqual(budget.history, ["予算は30万円"]);
    assert.equal(budget.detail, "交通費も含む");
    assert.deepEqual(next.pending, []);
    assert.equal(other.revision, 2);
    assert.equal(other.nodes.length, 2);
  });

  it("keeps leftover nodes when a restored revision is not newer", () => {
    const leftover = applyMindMapEvent(createEmptyMindMap("m-1"), {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
        createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
        createMindMapNode({
          id: "scope",
          label: "対象範囲",
          parentId: "root",
          sourceUtteranceIds: ["utt-1"],
        }),
      ],
      removes: [],
      pending: [],
    });
    const replayed = applyMindMapEvent(leftover, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
        createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
      ],
      removes: [],
      pending: [],
    });
    const grown = applyMindMapEvent(replayed, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 3,
      upserts: [
        createMindMapNode({
          id: "date",
          label: "日程",
          parentId: "scope",
          sourceUtteranceIds: ["utt-2"],
        }),
      ],
      removes: [],
      pending: [],
    });

    assert.equal(replayed.revision, 2);
    assert.deepEqual(
      replayed.nodes.map((node) => node.id),
      ["root", "scope"]
    );
    assert.equal(grown.revision, 3);
    assert.deepEqual(
      grown.nodes.map((node) => node.id),
      ["root", "scope", "date"]
    );
  });
});
