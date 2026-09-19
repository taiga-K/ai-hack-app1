import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { MeetingWebSocketClient } from "./websocket.ts";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = OPEN;
  static CONNECTING = CONNECTING;
  static CLOSED = CLOSED;

  readyState = CONNECTING;
  binaryType = "";
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  sent: string[] = [];

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push(typeof data === "string" ? data : "bin");
  }

  close(): void {
    this.readyState = CLOSED;
    this.onclose?.(new Event("close") as CloseEvent);
  }

  open(): void {
    this.readyState = OPEN;
    this.onopen?.(new Event("open"));
  }

  fail(): void {
    this.onerror?.(new Event("error"));
    this.readyState = CLOSED;
    this.onclose?.(new Event("close") as CloseEvent);
  }
}

const originalWebSocket = globalThis.WebSocket;

afterEach(() => {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = originalWebSocket;
});

function installFakeWebSocket(): void {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("MeetingWebSocketClient", () => {
  it("schedules only one reconnect when open fails with error and close", async () => {
    installFakeWebSocket();
    const client = new MeetingWebSocketClient("ws://example.test/ws", {
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectBaseDelayMs: 20,
      reconnectJitterMs: 0,
    });

    const connectPromise = client.connect({});
    assert.equal(FakeWebSocket.instances.length, 1);
    FakeWebSocket.instances[0]?.fail();
    await assert.rejects(connectPromise);

    await wait(5);
    assert.equal(FakeWebSocket.instances.length, 1);

    await wait(40);
    assert.equal(FakeWebSocket.instances.length, 2);
    client.disconnect();
  });

  it("notifies when reconnect attempts are exhausted", async () => {
    installFakeWebSocket();
    let failed = 0;
    const client = new MeetingWebSocketClient("ws://example.test/ws", {
      autoReconnect: true,
      maxReconnectAttempts: 1,
      reconnectBaseDelayMs: 15,
      reconnectJitterMs: 0,
    });

    const first = client.connect({
      onReconnectFailed: () => {
        failed += 1;
      },
    });
    FakeWebSocket.instances[0]?.fail();
    await assert.rejects(first);

    await wait(30);
    assert.equal(FakeWebSocket.instances.length, 2);
    FakeWebSocket.instances[1]?.fail();
    await wait(10);

    assert.equal(failed, 1);
    assert.equal(FakeWebSocket.instances.length, 2);
    client.disconnect();
  });

  it("keeps the socket open during drain so late messages can arrive", async () => {
    installFakeWebSocket();
    const received: string[] = [];
    const client = new MeetingWebSocketClient("ws://example.test/ws", {
      autoReconnect: false,
    });

    const connected = client.connect({
      onMessage: (event) => {
        received.push(String(event.data));
      },
    });
    FakeWebSocket.instances[0]?.open();
    await connected;

    const draining = client.drainAndDisconnect(30);
    FakeWebSocket.instances[0]?.onmessage?.(
      new MessageEvent("message", { data: '{"type":"utterance"}' })
    );
    await draining;

    assert.deepEqual(received, ['{"type":"utterance"}']);
    assert.equal(client.isConnected(), false);
  });
});
