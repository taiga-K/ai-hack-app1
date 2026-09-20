import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearDocumentDraft,
  draftMatchesSource,
  readDocumentDraft,
  writeDocumentDraft,
} from "./document-draft.ts";

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

describe("document draft storage", () => {
  it("keeps an edited draft for the same meeting", () => {
    installMemoryStorage();

    writeDocumentDraft("meet-1", "# 直したまとめ", {
      documentId: "doc-1",
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    const draft = readDocumentDraft("meet-1");
    assert.equal(draft?.markdown, "# 直したまとめ");
    assert.equal(readDocumentDraft("meet-2"), null);
    assert.equal(
      draftMatchesSource(draft, {
        documentId: "doc-1",
        createdAt: "2026-09-19T00:00:00.000Z",
      }),
      true
    );
  });

  it("does not match a draft against a newer finalized document", () => {
    installMemoryStorage();

    writeDocumentDraft("meet-1", "# 古い下書き", {
      documentId: "doc-old",
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    const draft = readDocumentDraft("meet-1");
    assert.equal(
      draftMatchesSource(draft, {
        documentId: "doc-new",
        createdAt: "2026-09-20T00:00:00.000Z",
      }),
      false
    );
    clearDocumentDraft("meet-1");
    assert.equal(readDocumentDraft("meet-1"), null);
  });
});
