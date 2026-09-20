import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDocumentHref, buildMeetingHref } from "./href.ts";
import type { BackTarget } from "./types.ts";

const target: BackTarget = {
  kind: "meeting",
  meetingId: "meet-1",
  title: "今日の会議",
  preview: false,
};

describe("buildMeetingHref", () => {
  it("returns the meeting floor with the title", () => {
    assert.equal(
      buildMeetingHref(target),
      "/meetings/meet-1?title=%E4%BB%8A%E6%97%A5%E3%81%AE%E4%BC%9A%E8%AD%B0"
    );
  });

  it("keeps the preview flag so notes stay visible", () => {
    assert.equal(
      buildMeetingHref({ ...target, preview: true }),
      "/meetings/meet-1?title=%E4%BB%8A%E6%97%A5%E3%81%AE%E4%BC%9A%E8%AD%B0&demo=1"
    );
  });

  it("keeps a completed summary so まとめを見る survives remount", () => {
    assert.equal(
      buildMeetingHref({ ...target, preview: true, hasCompletedSummary: true }),
      "/meetings/meet-1?title=%E4%BB%8A%E6%97%A5%E3%81%AE%E4%BC%9A%E8%AD%B0&demo=1&summary=1"
    );
  });

  it("keeps summary=1 when returning from a still-loading document", () => {
    assert.equal(
      buildMeetingHref({ ...target, hasCompletedSummary: true }),
      "/meetings/meet-1?title=%E4%BB%8A%E6%97%A5%E3%81%AE%E4%BC%9A%E8%AD%B0&summary=1"
    );
  });
});

describe("buildDocumentHref", () => {
  it("opens the same meeting's summary", () => {
    assert.equal(
      buildDocumentHref({ ...target, preview: true }),
      "/meetings/meet-1/document?title=%E4%BB%8A%E6%97%A5%E3%81%AE%E4%BC%9A%E8%AD%B0&demo=1"
    );
  });
});
