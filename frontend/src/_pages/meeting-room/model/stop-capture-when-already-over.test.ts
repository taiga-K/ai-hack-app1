import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stopCaptureWhenAlreadyOver } from "./stop-capture-when-already-over.ts";

describe("stopCaptureWhenAlreadyOver", () => {
  it("stops capture when a live remount becomes already over", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver(true, "live", () => {
      stopped += 1;
    });
    assert.equal(stopped, 1);
  });

  it("does not stop capture while the meeting is still live", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver(false, "live", () => {
      stopped += 1;
    });
    assert.equal(stopped, 0);
  });

  it("does not cut the finalize drain", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver(true, "finalizing", () => {
      stopped += 1;
    });
    assert.equal(stopped, 0);
  });

  it("does not stop capture after the meeting has already ended", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver(true, "ended", () => {
      stopped += 1;
    });
    assert.equal(stopped, 0);
  });
});
