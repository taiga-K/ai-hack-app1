import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMeetingFinalizeUrl,
  getMeetingRequirementsDownloadUrl,
  getMeetingRequirementsUrl,
} from "./http.ts";

describe("backend HTTP URLs", () => {
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
