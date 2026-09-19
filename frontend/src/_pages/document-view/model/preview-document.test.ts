import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPreviewRequirementDocument } from "./preview-document.ts";

describe("createPreviewRequirementDocument", () => {
  it("includes a concrete open issues section for the highlight callout", () => {
    const document = createPreviewRequirementDocument(
      "meet-1",
      "業務ヒアリング"
    );
    const openIssues = document.sections.find(
      (section) => section.sectionId === "open_issues"
    );

    assert.match(document.markdown, /未決事項/);
    assert.ok(openIssues);
    assert.match(openIssues.bodyMarkdown, /API連携/);
  });
});
