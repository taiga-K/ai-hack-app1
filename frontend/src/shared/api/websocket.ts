export interface MeetingWebSocketCallbacks {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onReconnectFailed?: () => void;
}

export interface MeetingWebSocketClientOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectJitterMs?: number;
  pingIntervalMs?: number;
}

const DEFAULT_DRAIN_GRACE_MS = 5000;

export class MeetingWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly autoReconnect: boolean;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectJitterMs: number;
  private readonly pingIntervalMs: number;
  private reconnectAttempt = 0;
  private manualClose = false;
  private callbacks: MeetingWebSocketCallbacks = {};
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private openingPromise: Promise<void> | null = null;
  private socketGeneration = 0;

  constructor(url: string, options: MeetingWebSocketClientOptions = {}) {
    this.url = url;
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 800;
    this.reconnectJitterMs = options.reconnectJitterMs ?? 200;
    this.pingIntervalMs = options.pingIntervalMs ?? 20000;
  }

  connect(callbacks: MeetingWebSocketCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.manualClose = false;
    this.reconnectAttempt = 0;
    return this.openSocket();
  }

  send(data: ArrayBuffer): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  sendJson(payload: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  disconnect(): void {
    this.manualClose = true;
    this.clearTimers();
    this.openingPromise = null;
    this.detachAndCloseSocket();
  }

  async drainAndDisconnect(
    graceMs: number = DEFAULT_DRAIN_GRACE_MS
  ): Promise<void> {
    this.manualClose = true;
    this.clearReconnectTimer();
    if (graceMs > 0 && this.isConnected()) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, graceMs);
      });
    }
    this.disconnect();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private detachAndCloseSocket(): void {
    const socket = this.ws;
    this.ws = null;
    if (!socket) {
      return;
    }
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.onopen = null;
    if (
      socket.readyState === WebSocket.CONNECTING ||
      socket.readyState === WebSocket.OPEN
    ) {
      socket.close();
    }
  }

  private openSocket(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.openingPromise) {
      return this.openingPromise;
    }

    this.openingPromise = new Promise((resolve, reject) => {
      try {
        this.detachAndCloseSocket();
        const generation = ++this.socketGeneration;
        const socket = new WebSocket(this.url);
        socket.binaryType = "arraybuffer";
        this.ws = socket;

        socket.onopen = () => {
          if (generation !== this.socketGeneration) {
            return;
          }
          this.reconnectAttempt = 0;
          this.openingPromise = null;
          this.startPing();
          this.callbacks.onOpen?.();
          resolve();
        };

        socket.onclose = (event) => {
          if (generation !== this.socketGeneration) {
            return;
          }
          this.stopPing();
          if (this.ws === socket) {
            this.ws = null;
          }
          this.openingPromise = null;
          this.callbacks.onClose?.(event);
          this.scheduleReconnect();
        };

        socket.onerror = (event) => {
          if (generation !== this.socketGeneration) {
            return;
          }
          this.callbacks.onError?.(event);
          if (socket.readyState !== WebSocket.OPEN) {
            reject(new Error("WebSocket接続に失敗しました"));
          }
        };

        socket.onmessage = (event) => {
          if (generation !== this.socketGeneration) {
            return;
          }
          this.callbacks.onMessage?.(event);
        };
      } catch (error) {
        this.openingPromise = null;
        reject(error);
      }
    });

    return this.openingPromise;
  }

  private scheduleReconnect(): void {
    if (this.manualClose || !this.autoReconnect) {
      return;
    }
    if (this.reconnectTimer !== null) {
      return;
    }
    if (
      this.openingPromise !== null ||
      (this.ws !== null && this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      this.callbacks.onReconnectFailed?.();
      return;
    }

    const jitter =
      this.reconnectJitterMs > 0
        ? Math.floor(Math.random() * this.reconnectJitterMs)
        : 0;
    const delay =
      this.reconnectBaseDelayMs * 2 ** this.reconnectAttempt + jitter;
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket().catch(() => {
        // The matching onclose is the single reconnect scheduler.
      });
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.sendJson({ action: "ping" });
    }, this.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopPing();
    this.clearReconnectTimer();
  }
}
