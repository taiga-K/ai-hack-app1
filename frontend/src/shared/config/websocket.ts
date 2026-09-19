const DEFAULT_BACKEND_WS_PORT = "8000";

function resolveWebSocketOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_WS_ORIGIN;
  if (configured && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return `ws://localhost:${DEFAULT_BACKEND_WS_PORT}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const isLocalDevPort =
    window.location.port === "3000" || window.location.port === "3001";

  if (isLocalDevPort) {
    return `${protocol}//${window.location.hostname}:${DEFAULT_BACKEND_WS_PORT}`;
  }

  return `${protocol}//${window.location.host}`;
}

export function getMeetingAudioWebSocketUrl(meetingId: string): string {
  return `${resolveWebSocketOrigin()}/ws/meetings/${encodeURIComponent(meetingId)}/audio`;
}
