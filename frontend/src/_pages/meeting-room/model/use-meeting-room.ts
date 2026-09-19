"use client";

import { useCallback, useRef, useState } from "react";
import type { Advice } from "@/entities/advice";
import type { MeetingPhase } from "@/entities/meeting";
import type { Utterance } from "@/entities/utterance";
import { useAudioCapture } from "@/features/audio-capture";
import { parseMeetingServerMessage } from "@/shared/api";
import { playSoftChime } from "@/shared/lib";
import { createPreviewAdvice, createPreviewUtterances } from "./preview-events";

function isEndedPhase(phase: MeetingPhase): boolean {
  return phase === "ended";
}

function upsertUtterance(
  current: Utterance[],
  incoming: Utterance
): Utterance[] {
  const next = current.filter((item) => item.id !== incoming.id);
  next.push(incoming);
  next.sort((left, right) => left.startMs - right.startMs);
  return next;
}

export interface UseMeetingRoomOptions {
  meetingId: string;
  preview?: boolean;
}

export function useMeetingRoom({
  meetingId,
  preview = false,
}: UseMeetingRoomOptions) {
  const [phase, setPhase] = useState<MeetingPhase>(preview ? "live" : "idle");
  const [utterances, setUtterances] = useState<Utterance[]>(() =>
    preview ? createPreviewUtterances(meetingId) : []
  );
  const [adviceItems, setAdviceItems] = useState<Advice[]>(() =>
    preview ? createPreviewAdvice(meetingId) : []
  );
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const chimeEnabledRef = useRef(true);
  const phaseRef = useRef<MeetingPhase>(preview ? "live" : "idle");
  const seenAdviceIdsRef = useRef<Set<string>>(
    new Set(
      preview ? createPreviewAdvice(meetingId).map((item) => item.id) : []
    )
  );

  const handleServerMessage = useCallback((event: MessageEvent) => {
    const parsed = parseMeetingServerMessage(event.data);
    if (parsed === null) {
      return;
    }

    switch (parsed.type) {
      case "pong":
        return;
      case "utterance":
        setUtterances((current) =>
          upsertUtterance(current, {
            id: parsed.id,
            meetingId: parsed.meetingId,
            speaker: parsed.speaker,
            text: parsed.text,
            startMs: parsed.startMs,
            endMs: parsed.endMs,
            isFinal: parsed.isFinal,
            createdAt: parsed.createdAt,
          })
        );
        return;
      case "advice":
        if (seenAdviceIdsRef.current.has(parsed.id)) {
          return;
        }
        seenAdviceIdsRef.current.add(parsed.id);
        setAdviceItems((current) => [
          {
            id: parsed.id,
            meetingId: parsed.meetingId,
            category: parsed.category,
            priority: parsed.priority,
            title: parsed.title,
            reason: parsed.reason,
            suggestedQuestion: parsed.suggestedQuestion,
            detectedAt: parsed.detectedAt,
            quote: parsed.quote,
          },
          ...current,
        ]);
        if (chimeEnabledRef.current) {
          playSoftChime();
        }
        return;
      default: {
        const _exhaustiveCheck: never = parsed;
        throw new Error(`Unhandled meeting event: ${_exhaustiveCheck}`);
      }
    }
  }, []);

  const { state, stats, startCapture, stopCapture, flushAndDisconnect } =
    useAudioCapture({
      meetingId,
      onMessage: handleServerMessage,
    });

  const handleStart = useCallback(async () => {
    if (isEndedPhase(phaseRef.current)) {
      return;
    }
    const started = await startCapture();
    if (!started || isEndedPhase(phaseRef.current)) {
      return;
    }
    phaseRef.current = "live";
    setPhase("live");
  }, [startCapture]);

  const handleStop = useCallback(() => {
    if (isEndedPhase(phaseRef.current)) {
      return;
    }
    stopCapture();
    phaseRef.current = "idle";
    setPhase("idle");
  }, [stopCapture]);

  const handleEndMeeting = useCallback(() => {
    phaseRef.current = "ended";
    setPhase("ended");
    void flushAndDisconnect();
  }, [flushAndDisconnect]);

  const handleToggleChime = useCallback((enabled: boolean) => {
    chimeEnabledRef.current = enabled;
    setChimeEnabled(enabled);
  }, []);

  return {
    phase,
    utterances,
    adviceItems,
    chimeEnabled,
    audio: state,
    stats,
    startCapture: handleStart,
    stopCapture: handleStop,
    endMeeting: handleEndMeeting,
    toggleChime: handleToggleChime,
  };
}
