import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readCompletedSummaryQuery } from "./href.ts";

describe("readCompletedSummaryQuery", () => {
  it("treats summary=1 as a completed document", () => {
    assert.equal(readCompletedSummaryQuery("1"), true);
  });

  it("ignores missing or other values", () => {
    assert.equal(readCompletedSummaryQuery(undefined), false);
    assert.equal(readCompletedSummaryQuery("0"), false);
  });
});
