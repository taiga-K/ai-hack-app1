import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIND_MAP_RELATION_LABELS,
  decorationForMindMapNode,
  describeMindMapNode,
  describeMindMapStatus,
  getMindMapNodePresentation,
} from "./labels.ts";
import { createMindMapNode } from "./types.ts";

describe("getMindMapNodePresentation", () => {
  it("shows one plain-language chip per node", () => {
    const root = getMindMapNodePresentation(
      createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
      1
    );
    const decided = getMindMapNodePresentation(
      createMindMapNode({
        id: "p",
        label: "内製",
        parentId: "root",
        kind: "proposal",
        status: "decided",
      }),
      2
    );
    const concern = getMindMapNodePresentation(
      createMindMapNode({
        id: "c",
        label: "納期",
        parentId: "root",
        kind: "concern",
      }),
      2
    );
    const action = getMindMapNodePresentation(
      createMindMapNode({
        id: "a",
        label: "見積もり",
        parentId: "root",
        kind: "action",
        status: "pending",
      }),
      3
    );
    const superseded = getMindMapNodePresentation(
      createMindMapNode({
        id: "s",
        label: "20万円",
        parentId: "root",
        kind: "decision",
        status: "superseded",
      }),
      3
    );

    assert.deepEqual(root, { chip: null, tone: "root", struck: false });
    assert.equal(decided.chip, "採用");
    assert.equal(decided.tone, "decision");
    assert.equal(concern.chip, "気になる点");
    assert.equal(action.chip, "つぎにやること");
    assert.equal(superseded.chip, "言いなおし前");
    assert.equal(superseded.struck, true);
    assert.equal(MIND_MAP_RELATION_LABELS.opposes, "反対");
  });

  it("does not repeat 決定 for a decision node", () => {
    assert.equal(
      describeMindMapNode(
        createMindMapNode({
          id: "d",
          label: "内製で決定",
          parentId: null,
          kind: "decision",
          status: "decided",
        })
      ),
      "決定"
    );
    assert.equal(
      describeMindMapNode(
        createMindMapNode({
          id: "p",
          label: "内製",
          parentId: null,
          kind: "proposal",
          status: "decided",
        })
      ),
      "案・採用"
    );
    assert.equal(
      describeMindMapNode(
        createMindMapNode({ id: "t", label: "予算", parentId: null })
      ),
      "話題・まだ決まっていない"
    );
  });

  it("describes decided and undecided from the same data", () => {
    assert.equal(
      describeMindMapStatus(
        createMindMapNode({ id: "t", label: "予算", parentId: null })
      ),
      "まだ決まっていない"
    );
    assert.equal(
      describeMindMapStatus(
        createMindMapNode({
          id: "d",
          label: "内製で決定",
          parentId: null,
          kind: "decision",
        })
      ),
      "決定"
    );
    assert.equal(
      describeMindMapStatus(
        createMindMapNode({
          id: "p",
          label: "例外",
          parentId: null,
          status: "pending",
        })
      ),
      "あとで"
    );
  });
});

describe("decorationForMindMapNode", () => {
  it("reserves room for the chip and the hidden count", () => {
    const root = createMindMapNode({
      id: "root",
      label: "今日の会議",
      parentId: null,
    });
    const decision = createMindMapNode({
      id: "d",
      label: "内製で決定",
      parentId: "root",
      kind: "decision",
      status: "decided",
    });
    const visibility = {
      visible: [root, decision],
      hiddenChildCount: new Map([["root", 2]]),
      depthById: new Map([
        ["root", 1],
        ["d", 2],
      ]),
    };

    assert.deepEqual(decorationForMindMapNode(root, visibility), {
      chipChars: 0,
      badge: true,
    });
    assert.deepEqual(decorationForMindMapNode(decision, visibility), {
      chipChars: 2,
      badge: false,
    });
  });
});
