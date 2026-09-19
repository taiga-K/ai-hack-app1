export interface MeetingWebSocketCallbacks {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
}

export interface MeetingWebSocketClientOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  pingIntervalMs?: number;
}

export class MeetingWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly autoReconnect: boolean;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly pingIntervalMs: number;
  private reconnectAttempt = 0;
  private manualClose = false;
  private callbacks: MeetingWebSocketCallbacks = {};
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, options: MeetingWebSocketClientOptions = {}) {
    this.url = url;
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 800;
    this.pingIntervalMs = options.pingIntervalMs ?? 20000;
  }

  connect(callbacks: MeetingWebSocketCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.manualClose = false;
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
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        const socket = new WebSocket(this.url);
        socket.binaryType = "arraybuffer";
        this.ws = socket;

        socket.onopen = () => {
          this.reconnectAttempt = 0;
          this.startPing();
          this.callbacks.onOpen?.();
          resolve();
        };

        socket.onclose = (event) => {
          this.stopPing();
          this.callbacks.onClose?.(event);
          this.ws = null;
          this.scheduleReconnect();
        };

        socket.onerror = (event) => {
          this.callbacks.onError?.(event);
          if (socket.readyState !== WebSocket.OPEN) {
            reject(new Error("WebSocket接続に失敗しました"));
          }
        };

        socket.onmessage = (event) => {
          this.callbacks.onMessage?.(event);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.manualClose || !this.autoReconnect) {
      return;
    }
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      return;
    }

    const delay =
      this.reconnectBaseDelayMs * 2 ** this.reconnectAttempt +
      Math.floor(Math.random() * 200);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      void this.openSocket().catch(() => {
        this.scheduleReconnect();
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

  private clearTimers(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
