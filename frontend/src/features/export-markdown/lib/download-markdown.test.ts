import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMarkdownDownloadFilename } from "./download-markdown.ts";

describe("getMarkdownDownloadFilename", () => {
  it("matches the backend download filename", () => {
    assert.equal(
      getMarkdownDownloadFilename("meet-final-1"),
      "requirements-meet-final-1.md"
    );
  });
});
