"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DualAudioCaptureService } from "../lib/audio-capture-service";
import { AudioWebSocketClient } from "../lib/audio-websocket-client";
import type { AudioCaptureState, AudioStreamStats } from "../model/types";

export interface UseAudioCaptureOptions {
  meetingId?: string;
  wsBaseUrl?: string;
  autoConnectWebSocket?: boolean;
}

export function useAudioCapture({
  meetingId = "default",
  wsBaseUrl,
  autoConnectWebSocket = true,
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

  // Initialize service instances
  useEffect(() => {
    audioServiceRef.current = new DualAudioCaptureService(16000);

    return () => {
      if (audioServiceRef.current) {
        audioServiceRef.current.stop();
      }
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
      }
    };
  }, []);

  const stopCapture = useCallback(() => {
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

  const startCapture = useCallback(async () => {
    if (!audioServiceRef.current) return;

    setState((prev) => ({
      ...prev,
      status: "requesting_permission",
      errorMessage: null,
    }));

    try {
      // Connect WebSocket if enabled
      if (autoConnectWebSocket) {
        const resolvedWsUrl =
          wsBaseUrl ||
          (typeof window !== "undefined"
            ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/meetings/${meetingId}/audio`
            : `ws://localhost:8000/ws/meetings/${meetingId}/audio`);

        setState((prev) => ({ ...prev, wsStatus: "connecting" }));
        const wsClient = new AudioWebSocketClient(resolvedWsUrl);
        wsClientRef.current = wsClient;

        try {
          await wsClient.connect({
            onOpen: () => {
              setState((prev) => ({ ...prev, wsStatus: "connected" }));
            },
            onClose: () => {
              setState((prev) => ({ ...prev, wsStatus: "disconnected" }));
            },
            onError: () => {
              setState((prev) => ({ ...prev, wsStatus: "error" }));
            },
          });
        } catch {
          // Allow capture even if backend websocket is not yet connected or failed
          setState((prev) => ({ ...prev, wsStatus: "error" }));
        }
      }

      // Start dual capture
      await audioServiceRef.current.startCapture({
        onPCMChunk: (chunk: ArrayBuffer) => {
          if (wsClientRef.current && wsClientRef.current.isConnected()) {
            wsClientRef.current.send(chunk);
          }
          setStats((prev) => ({
            ...prev,
            bytesSent: prev.bytesSent + chunk.byteLength,
            chunksSent: prev.chunksSent + 1,
          }));
        },
        onVolumeChange: ({ micVolume, tabVolume }) => {
          setState((prev) => ({
            ...prev,
            micVolume,
            tabVolume,
          }));
        },
        onEnded: (source) => {
          if (source === "tab") {
            // If tab sharing ended, stop session
            stopCapture();
          }
        },
        onError: (err) => {
          setState((prev) => ({
            ...prev,
            status: "error",
            errorMessage: err.message,
          }));
          stopCapture();
        },
      });

      setState((prev) => ({
        ...prev,
        status: "capturing",
        isRecording: true,
        hasPermission: true,
        hasMicStream: true,
        hasTabStream: true,
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "音声キャプチャに失敗しました";
      setState((prev) => ({
        ...prev,
        status: "error",
        isRecording: false,
        errorMessage: message,
      }));
      stopCapture();
    }
  }, [autoConnectWebSocket, meetingId, stopCapture, wsBaseUrl]);

  return {
    state,
    stats,
    startCapture,
    stopCapture,
  };
}
