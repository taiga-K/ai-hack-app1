export interface AudioWebSocketCallbacks {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
}

export class AudioWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnecting: boolean = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(callbacks: AudioWebSocketCallbacks): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;
      try {
        const socket = new WebSocket(this.url);
        socket.binaryType = "arraybuffer";
        this.ws = socket;

        socket.onopen = () => {
          this.isConnecting = false;
          if (callbacks.onOpen) callbacks.onOpen();
          resolve();
        };

        socket.onclose = (event) => {
          this.isConnecting = false;
          if (callbacks.onClose) callbacks.onClose(event);
        };

        socket.onerror = (event) => {
          this.isConnecting = false;
          if (callbacks.onError) callbacks.onError(event);
          reject(new Error("WebSocket接続に失敗しました"));
        };

        socket.onmessage = (event) => {
          if (callbacks.onMessage) callbacks.onMessage(event);
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  send(data: ArrayBuffer): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  disconnect(): void {
    if (this.ws) {
      // Remove handlers before close to prevent duplicate triggering
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
