import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBackendApiUrl,
  getMeetingFinalizeUrl,
  getMeetingRequirementsDownloadUrl,
  getMeetingRequirementsUrl,
  resolveBackendHttpOrigin,
} from "./http.ts";

describe("backend HTTP URLs", () => {
  it("keeps browser REST on the same-origin /api/v1 rewrite", () => {
    const origin = resolveBackendHttpOrigin();
    if (typeof window !== "undefined") {
      assert.equal(origin, "");
    }
    assert.match(
      getBackendApiUrl("/api/v1/meetings/meet-1/finalize"),
      /\/api\/v1\//
    );
    assert.equal(
      getBackendApiUrl("/api/v1/health").includes("NEXT_PUBLIC"),
      false
    );
  });

  it("builds finalize, get, and download paths for the existing API", () => {
    assert.match(
      getMeetingFinalizeUrl("meet-1"),
      /\/api\/v1\/meetings\/meet-1\/finalize$/
    );
    assert.match(
      getMeetingRequirementsUrl("meet-1"),
      /\/api\/v1\/meetings\/meet-1\/requirements$/
    );
    assert.match(
      getMeetingRequirementsDownloadUrl("meet-1"),
      /\/api\/v1\/meetings\/meet-1\/requirements\/download$/
    );
  });
});
