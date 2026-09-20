import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearMeetingFloorSnapshot,
  parseMeetingFloorSnapshot,
  readMeetingFloorSnapshot,
  writeMeetingFloorSnapshot,
} from "./meeting-floor-snapshot.ts";

function installMemoryStorages(): void {
  function makeStorage(): Storage {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
    };
  }

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: makeStorage(),
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: makeStorage(),
  });
}

const snapshot = {
  ended: true,
  utterances: [
    {
      id: "utt-1",
      meetingId: "meet-1",
      speaker: "local_pm" as const,
      text: "実会議の残ったメモです。",
      startMs: 1000,
      endMs: 2000,
      isFinal: true,
      createdAt: "2026-09-20T00:00:01.000Z",
    },
  ],
  adviceItems: [
    {
      id: "adv-1",
      meetingId: "meet-1",
      category: "unexplained_jargon" as const,
      priority: "high" as const,
      title: "実会議の残ったささやき",
      reason: "用語が未定義です。",
      suggestedQuestion: "その言葉は何を指しますか？",
      detectedAt: "2026-09-20T00:00:02.000Z",
      quote: "API連携",
    },
  ],
};

describe("meeting floor snapshot", () => {
  it("restores memos and whispers for the same meeting", () => {
    installMemoryStorages();
    writeMeetingFloorSnapshot("meet-1", snapshot);

    assert.deepEqual(readMeetingFloorSnapshot("meet-1"), snapshot);
    assert.equal(readMeetingFloorSnapshot("meet-2"), null);
  });

  it("keeps the ended flag so remount does not look live", () => {
    installMemoryStorages();
    writeMeetingFloorSnapshot("meet-1", snapshot);
    const restored = readMeetingFloorSnapshot("meet-1");
    assert.equal(restored?.ended, true);
    assert.equal(restored?.utterances[0]?.text, "実会議の残ったメモです。");
    assert.equal(restored?.adviceItems[0]?.title, "実会議の残ったささやき");
  });

  it("reads localStorage when sessionStorage is empty", () => {
    installMemoryStorages();
    writeMeetingFloorSnapshot("meet-1", snapshot);
    globalThis.sessionStorage.removeItem(
      "return-to-meeting:floor-snapshot:meet-1"
    );
    assert.deepEqual(readMeetingFloorSnapshot("meet-1"), snapshot);
  });

  it("does not treat a failed finalize as ended", () => {
    installMemoryStorages();
    writeMeetingFloorSnapshot("meet-1", {
      ...snapshot,
      ended: false,
    });
    const restored = readMeetingFloorSnapshot("meet-1");
    assert.equal(restored?.ended, false);
    assert.equal(restored?.utterances[0]?.text, "実会議の残ったメモです。");
  });

  it("ignores broken JSON", () => {
    assert.equal(parseMeetingFloorSnapshot("{"), null);
    assert.equal(parseMeetingFloorSnapshot(""), null);
    clearMeetingFloorSnapshot("meet-1");
    assert.equal(readMeetingFloorSnapshot("meet-1"), null);
  });
});
