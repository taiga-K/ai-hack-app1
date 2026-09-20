import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAdviceAction,
  captureAdviceUndo,
  collectSeenAdviceIds,
  undoAdviceAction,
} from "./resolve-advice.ts";

function advice(id: string): { id: string; title: string } {
  return { id, title: `${id} title` };
}

describe("applyAdviceAction", () => {
  it("removes 聞けた and 不要 from the live list", () => {
    const lists = {
      active: [advice("a"), advice("b")],
      later: [advice("c")],
    };

    assert.deepEqual(applyAdviceAction(lists, "a", "heard"), {
      active: [advice("b")],
      later: [advice("c")],
    });
    assert.deepEqual(applyAdviceAction(lists, "b", "unneeded"), {
      active: [advice("a")],
      later: [advice("c")],
    });
  });

  it("moves あとで out of the live list without discarding it", () => {
    const lists = {
      active: [advice("a"), advice("b")],
      later: [],
    };

    assert.deepEqual(applyAdviceAction(lists, "a", "later"), {
      active: [advice("b")],
      later: [advice("a")],
    });
  });

  it("lets 聞けた or 不要 clear a parked later item", () => {
    const lists = {
      active: [advice("a")],
      later: [advice("b")],
    };

    assert.deepEqual(applyAdviceAction(lists, "b", "heard"), {
      active: [advice("a")],
      later: [],
    });
  });

  it("does not discard an item that is already later", () => {
    const lists = {
      active: [],
      later: [advice("a")],
    };

    assert.deepEqual(applyAdviceAction(lists, "a", "later"), lists);
  });
});

describe("undoAdviceAction", () => {
  it("puts a dismissed item back on the live list", () => {
    const lists = {
      active: [advice("a"), advice("b")],
      later: [],
    };
    const undo = captureAdviceUndo(lists, "a", "unneeded");
    assert.ok(undo);
    const removed = applyAdviceAction(lists, "a", "unneeded");
    assert.deepEqual(undoAdviceAction(removed, undo), lists);
  });

  it("moves a parked item back to the live list", () => {
    const lists = {
      active: [advice("a"), advice("b")],
      later: [],
    };
    const undo = captureAdviceUndo(lists, "a", "later");
    assert.ok(undo);
    const parked = applyAdviceAction(lists, "a", "later");
    assert.deepEqual(undoAdviceAction(parked, undo), {
      active: [advice("a"), advice("b")],
      later: [],
    });
  });
});

describe("collectSeenAdviceIds", () => {
  it("keeps resolved ids so discarded advice does not return", () => {
    const seen = collectSeenAdviceIds([advice("a")], [advice("b")], ["c"]);
    assert.deepEqual([...seen].sort(), ["a", "b", "c"]);
  });
});
