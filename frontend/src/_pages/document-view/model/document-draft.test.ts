import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readDocumentDraft, writeDocumentDraft } from "./document-draft.ts";

describe("document draft storage", () => {
  it("keeps an edited draft for the same meeting", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });

    writeDocumentDraft("meet-1", "# 直したまとめ");
    assert.equal(readDocumentDraft("meet-1"), "# 直したまとめ");
    assert.equal(readDocumentDraft("meet-2"), null);
  });
});
