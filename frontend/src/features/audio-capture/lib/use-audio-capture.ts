"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMeetingAudioWebSocketUrl } from "@/shared/config";
import { DualAudioCaptureService } from "../lib/audio-capture-service";
import { AudioWebSocketClient } from "../lib/audio-websocket-client";
import type { AudioCaptureState, AudioStreamStats } from "../model/types";

export interface UseAudioCaptureOptions {
  meetingId?: string;
  wsBaseUrl?: string;
  autoConnectWebSocket?: boolean;
  onMessage?: (event: MessageEvent) => void;
}

export function useAudioCapture({
  meetingId = "default",
  wsBaseUrl,
  autoConnectWebSocket = true,
  onMessage,
}: UseAudioCaptureOptions = {}) {
  const [state, setState] = useState<AudioCaptureState>({
    status: "idle",
    wsStatus: "disconnected",
    isRecording: false,
    hasPermission: false,
    hasMicStream: false,
    hasTabStream: false,
    micVolume: 0,
    tabVolume: 0,
    errorMessage: null,
  });

  const [stats, setStats] = useState<AudioStreamStats>({
    bytesSent: 0,
    chunksSent: 0,
    sampleRate: 16000,
  });

  const audioServiceRef = useRef<DualAudioCaptureService | null>(null);
  const wsClientRef = useRef<AudioWebSocketClient | null>(null);
  const onMessageRef = useRef(onMessage);
  const sessionRef = useRef(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Initialize service instances
  useEffect(() => {
    audioServiceRef.current = new DualAudioCaptureService(16000);

    return () => {
      sessionRef.current += 1;
      if (audioServiceRef.current) {
        audioServiceRef.current.stop();
      }
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
      }
    };
  }, []);

  const discardInFlightStart = useCallback(
    (wsClient?: AudioWebSocketClient | null) => {
      if (audioServiceRef.current) {
        audioServiceRef.current.stop();
      }
      if (wsClient && wsClientRef.current === wsClient) {
        wsClient.disconnect();
        wsClientRef.current = null;
      }
    },
    []
  );

  const stopCapture = useCallback(() => {
    sessionRef.current += 1;
    if (audioServiceRef.current) {
      audioServiceRef.current.stop();
    }
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      status: "idle",
      wsStatus: "disconnected",
      isRecording: false,
      hasMicStream: false,
      hasTabStream: false,
      micVolume: 0,
      tabVolume: 0,
    }));
  }, []);

  const startCapture = useCallback(async (): Promise<boolean> => {
    if (!audioServiceRef.current) {
      return false;
    }

    const sessionId = ++sessionRef.current;
    let wsClient: AudioWebSocketClient | null = null;

    setState((prev) => ({
      ...prev,
      status: "requesting_permission",
      errorMessage: null,
    }));

    try {
      if (autoConnectWebSocket) {
        const resolvedWsUrl =
          wsBaseUrl || getMeetingAudioWebSocketUrl(meetingId);

        setState((prev) => ({ ...prev, wsStatus: "connecting" }));
        wsClient = new AudioWebSocketClient(resolvedWsUrl);
        wsClientRef.current = wsClient;

        try {
          await wsClient.connect({
            onOpen: () => {
              if (sessionRef.current !== sessionId) {
                return;
              }
              setState((prev) => ({ ...prev, wsStatus: "connected" }));
            },
            onClose: () => {
              if (sessionRef.current !== sessionId) {
                return;
              }
              setState((prev) => ({
                ...prev,
                wsStatus: prev.isRecording ? "connecting" : "disconnected",
              }));
            },
            onError: () => {
              if (sessionRef.current !== sessionId) {
                return;
              }
              setState((prev) => ({ ...prev, wsStatus: "error" }));
            },
            onReconnectFailed: () => {
              if (sessionRef.current !== sessionId) {
                return;
              }
              setState((prev) => ({ ...prev, wsStatus: "error" }));
            },
            onMessage: (event) => {
              if (sessionRef.current !== sessionId) {
                return;
              }
              onMessageRef.current?.(event);
            },
          });
        } catch {
          if (sessionRef.current !== sessionId) {
            discardInFlightStart(wsClient);
            return false;
          }
          // Allow capture even if backend websocket is not yet connected or failed
          setState((prev) => ({ ...prev, wsStatus: "error" }));
        }
      }

      if (sessionRef.current !== sessionId) {
        discardInFlightStart(wsClient);
        return false;
      }

      await audioServiceRef.current.startCapture({
        onPCMChunk: (chunk: ArrayBuffer) => {
          if (sessionRef.current !== sessionId) {
            return;
          }
          if (wsClientRef.current && wsClientRef.current.isConnected()) {
            const sent = wsClientRef.current.send(chunk);
            if (sent) {
              setStats((prev) => ({
                ...prev,
                bytesSent: prev.bytesSent + chunk.byteLength,
                chunksSent: prev.chunksSent + 1,
              }));
            }
          }
        },
        onVolumeChange: ({ micVolume, tabVolume }) => {
          if (sessionRef.current !== sessionId) {
            return;
          }
          setState((prev) => ({
            ...prev,
            micVolume,
            tabVolume,
          }));
        },
        onEnded: (source) => {
          if (sessionRef.current !== sessionId) {
            return;
          }
          if (source === "tab") {
            stopCapture();
          }
        },
        onError: (err) => {
          if (sessionRef.current !== sessionId) {
            return;
          }
          setState((prev) => ({
            ...prev,
            status: "error",
            errorMessage: err.message,
          }));
          stopCapture();
        },
      });

      if (sessionRef.current !== sessionId) {
        discardInFlightStart(wsClient);
        return false;
      }

      setState((prev) => ({
        ...prev,
        status: "capturing",
        isRecording: true,
        hasPermission: true,
        hasMicStream: true,
        hasTabStream: true,
      }));
      return true;
    } catch (err: unknown) {
      if (sessionRef.current !== sessionId) {
        discardInFlightStart(wsClient);
        return false;
      }
      const message =
        err instanceof Error ? err.message : "音声キャプチャに失敗しました";
      setState((prev) => ({
        ...prev,
        status: "error",
        isRecording: false,
        errorMessage: message,
      }));
      stopCapture();
      return false;
    }
  }, [
    autoConnectWebSocket,
    discardInFlightStart,
    meetingId,
    stopCapture,
    wsBaseUrl,
  ]);

  const sendJson = useCallback((payload: Record<string, unknown>): boolean => {
    if (!wsClientRef.current) {
      return false;
    }
    return wsClientRef.current.sendJson(payload);
  }, []);

  const flushAndDisconnect = useCallback(async (graceMs = 5000) => {
    sessionRef.current += 1;
    if (audioServiceRef.current) {
      audioServiceRef.current.stop();
    }

    setState((prev) => ({
      ...prev,
      isRecording: false,
      hasMicStream: false,
      hasTabStream: false,
      micVolume: 0,
      tabVolume: 0,
    }));

    const wsClient = wsClientRef.current;
    if (wsClient) {
      wsClient.sendJson({ action: "flush" });
      wsClient.sendJson({ action: "analyze" });
      await wsClient.drainAndDisconnect(graceMs);
      wsClientRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      status: "idle",
      wsStatus: "disconnected",
      isRecording: false,
      hasMicStream: false,
      hasTabStream: false,
      micVolume: 0,
      tabVolume: 0,
    }));
  }, []);

  return {
    state,
    stats,
    startCapture,
    stopCapture,
    sendJson,
    flushAndDisconnect,
  };
}
