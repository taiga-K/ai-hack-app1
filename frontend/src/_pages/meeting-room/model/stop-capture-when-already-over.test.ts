import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stopCaptureWhenAlreadyOver } from "./stop-capture-when-already-over.ts";

describe("stopCaptureWhenAlreadyOver", () => {
  it("stops capture when the meeting becomes already over", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver(true, () => {
      stopped += 1;
    });
    assert.equal(stopped, 1);
  });

  it("does not stop capture while the meeting is still live", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver(false, () => {
      stopped += 1;
    });
    assert.equal(stopped, 0);
  });
});
