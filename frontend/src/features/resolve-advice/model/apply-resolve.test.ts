import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAdviceResolve } from "./apply-resolve.ts";

const first = { id: "a" };
const second = { id: "b" };
const third = { id: "c" };

describe("applyAdviceResolve", () => {
  it("heard and unneeded drop the item from the current list", () => {
    const heard = applyAdviceResolve(
      { current: [first, second], later: [] },
      "a",
      "heard"
    );
    assert.deepEqual(heard, { current: [second], later: [] });

    const unneeded = applyAdviceResolve(
      { current: [first, second], later: [] },
      "b",
      "unneeded"
    );
    assert.deepEqual(unneeded, { current: [first], later: [] });
  });

  it("later parks the item instead of discarding it", () => {
    const parked = applyAdviceResolve(
      { current: [first, second, third], later: [] },
      "b",
      "later"
    );
    assert.deepEqual(parked, { current: [first, third], later: [second] });
  });

  it("heard can still clear an item from the later pile", () => {
    const resolved = applyAdviceResolve(
      { current: [first], later: [second] },
      "b",
      "heard"
    );
    assert.deepEqual(resolved, { current: [first], later: [] });
  });

  it("ignores unknown ids", () => {
    const lists = { current: [first], later: [second] };
    assert.deepEqual(applyAdviceResolve(lists, "missing", "later"), lists);
  });
});
