import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMindMapEvent } from "./apply.ts";
import { createEmptyMindMap } from "./types.ts";

describe("applyMindMapEvent", () => {
  it("applies upserts in revision order and ignores stale events", () => {
    const empty = createEmptyMindMap("m-1");
    const first = applyMindMapEvent(empty, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 1,
      upserts: [
        {
          id: "root",
          label: "今日の会議",
          parentId: null,
          sourceUtteranceIds: [],
        },
      ],
      removes: [],
    });
    const second = applyMindMapEvent(first, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
        {
          id: "scope",
          label: "対象範囲",
          parentId: "root",
          sourceUtteranceIds: ["utt-1"],
        },
      ],
      removes: [],
    });
    const stale = applyMindMapEvent(second, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 1,
      upserts: [
        {
          id: "stale",
          label: "古い",
          parentId: null,
          sourceUtteranceIds: [],
        },
      ],
      removes: ["scope"],
    });

    assert.equal(first.revision, 1);
    assert.equal(second.nodes.length, 2);
    assert.equal(stale.revision, 2);
    assert.equal(
      stale.nodes.some((node) => node.id === "scope"),
      true
    );
    assert.equal(
      stale.nodes.some((node) => node.id === "stale"),
      false
    );
  });

  it("removes topics and ignores other meetings", () => {
    const current = applyMindMapEvent(createEmptyMindMap("m-1"), {
      type: "mindmap",
      meetingId: "m-1",
      revision: 1,
      upserts: [
        {
          id: "root",
          label: "今日の会議",
          parentId: null,
          sourceUtteranceIds: [],
        },
        {
          id: "noise",
          label: "雑談",
          parentId: "root",
          sourceUtteranceIds: [],
        },
      ],
      removes: [],
    });
    const next = applyMindMapEvent(current, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [],
      removes: ["noise"],
    });
    const other = applyMindMapEvent(next, {
      type: "mindmap",
      meetingId: "other",
      revision: 3,
      upserts: [
        {
          id: "x",
          label: "別会議",
          parentId: null,
          sourceUtteranceIds: [],
        },
      ],
      removes: ["root"],
    });

    assert.deepEqual(
      next.nodes.map((node) => node.id),
      ["root"]
    );
    assert.equal(other.revision, 2);
    assert.equal(other.nodes.length, 1);
  });

  it("keeps leftover nodes when a restored revision is not newer", () => {
    const leftover = applyMindMapEvent(createEmptyMindMap("m-1"), {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
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
      ],
      removes: [],
    });
    const replayed = applyMindMapEvent(leftover, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 2,
      upserts: [
        {
          id: "root",
          label: "今日の会議",
          parentId: null,
          sourceUtteranceIds: [],
        },
      ],
      removes: [],
    });
    const grown = applyMindMapEvent(replayed, {
      type: "mindmap",
      meetingId: "m-1",
      revision: 3,
      upserts: [
        {
          id: "date",
          label: "日程",
          parentId: "scope",
          sourceUtteranceIds: ["utt-2"],
        },
      ],
      removes: [],
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
