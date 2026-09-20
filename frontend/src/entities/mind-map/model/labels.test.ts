import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIND_MAP_RELATION_LABELS,
  decorationForMindMapNode,
  describeMindMapNode,
  describeMindMapStatus,
  getMindMapNodePresentation,
  summarizeMindMapBranch,
  summarizeMindMapDecisions,
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
    assert.equal(superseded.chip, "いまは対象外");
    assert.equal(superseded.struck, true);
    assert.equal(MIND_MAP_RELATION_LABELS.opposes, "懸念");
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

describe("summarizeMindMapBranch", () => {
  const nodes = [
    createMindMapNode({ id: "root", label: "今日の会議", parentId: null }),
    createMindMapNode({ id: "scope", label: "対象範囲", parentId: "root" }),
    createMindMapNode({
      id: "renewal",
      label: "更新申請だけ",
      parentId: "scope",
      kind: "proposal",
      status: "decided",
    }),
    createMindMapNode({
      id: "decision",
      label: "更新申請に限定で決定",
      parentId: "scope",
      kind: "decision",
      status: "decided",
    }),
    createMindMapNode({
      id: "homework",
      label: "例外は宿題",
      parentId: "scope",
      kind: "action",
    }),
    createMindMapNode({
      id: "old",
      label: "前の決定",
      parentId: "scope",
      kind: "decision",
      status: "superseded",
    }),
    createMindMapNode({
      id: "all",
      label: "申請ぜんぶ",
      parentId: "scope",
      kind: "proposal",
    }),
    createMindMapNode({ id: "due", label: "来月末の本番", parentId: "root" }),
  ];

  it("reads decisions and next actions out of a topic's branch", () => {
    const scope = nodes[1];
    assert.ok(scope);
    const summary = summarizeMindMapBranch(scope, nodes);
    assert.deepEqual(
      summary.decisions.map((node) => node.id),
      ["decision"]
    );
    assert.deepEqual(
      summary.adopted.map((node) => node.id),
      ["renewal"]
    );
    assert.deepEqual(
      summary.actions.map((node) => node.id),
      ["homework"]
    );
    assert.equal(summary.openCount, 1);

    const due = nodes[7];
    assert.ok(due);
    const empty = summarizeMindMapBranch(due, nodes);
    assert.equal(empty.decisions.length, 0);
    assert.equal(empty.actions.length, 0);
  });

  it("summarizes the whole map without superseded claims", () => {
    const summary = summarizeMindMapDecisions(nodes);
    assert.deepEqual(
      summary.decided.map((node) => node.id),
      ["decision"]
    );
    assert.deepEqual(
      summary.actions.map((node) => node.id),
      ["homework"]
    );
    const adoptedOnly = summarizeMindMapDecisions(
      nodes.filter((node) => node.kind !== "decision")
    );
    assert.deepEqual(
      adoptedOnly.decided.map((node) => node.id),
      ["renewal"]
    );
  });
});
