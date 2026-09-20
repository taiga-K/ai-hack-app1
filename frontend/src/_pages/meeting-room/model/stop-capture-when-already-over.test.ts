import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stopCaptureWhenAlreadyOver } from "./stop-capture-when-already-over.ts";

describe("stopCaptureWhenAlreadyOver", () => {
  it("stops capture when a completed summary is found on a live floor", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver("found", "live", () => {
      stopped += 1;
    });
    assert.equal(stopped, 1);
  });

  it("stops capture when the meeting is truly ended", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver("missing", "ended", () => {
      stopped += 1;
    });
    assert.equal(stopped, 1);
  });

  it("keeps capture while lookup is still checking or failed", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver("checking", "live", () => {
      stopped += 1;
    });
    stopCaptureWhenAlreadyOver("error", "idle", () => {
      stopped += 1;
    });
    assert.equal(stopped, 0);
  });

  it("does not cut the finalize drain", () => {
    let stopped = 0;
    stopCaptureWhenAlreadyOver("found", "finalizing", () => {
      stopped += 1;
    });
    stopCaptureWhenAlreadyOver("missing", "finalizing", () => {
      stopped += 1;
    });
    assert.equal(stopped, 0);
  });
});
