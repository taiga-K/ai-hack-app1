import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyBackendHttpError,
  isAbortError,
  readBackendErrorDetail,
  toUserFacingHttpErrorMessage,
} from "./http.ts";

describe("backend HTTP error mapping", () => {
  it("reads FastAPI string and array details", () => {
    assert.equal(
      readBackendErrorDetail({
        detail: "Requirements document not found for meeting 'meet-1'.",
      }),
      "Requirements document not found for meeting 'meet-1'."
    );
    assert.equal(
      readBackendErrorDetail({
        detail: [{ msg: "String should match pattern" }],
      }),
      "String should match pattern"
    );
  });

  it("maps finalize and requirements status codes", () => {
    assert.equal(classifyBackendHttpError(400, null), "no_transcript");
    assert.equal(classifyBackendHttpError(404, null), "not_found");
    assert.equal(classifyBackendHttpError(503, null), "llm_unconfigured");
    assert.equal(classifyBackendHttpError(502, null), "generation_failed");
    assert.match(toUserFacingHttpErrorMessage("no_transcript"), /発話/);
    assert.match(toUserFacingHttpErrorMessage("not_found"), /要件定義書/);
  });

  it("treats DOM abort as an abort error", () => {
    assert.equal(isAbortError(new DOMException("aborted", "AbortError")), true);
    assert.equal(isAbortError(new Error("network down")), false);
  });
});
