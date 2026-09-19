"use client";

import { useCallback, useRef, useState } from "react";
import type { Advice } from "@/entities/advice";
import type { MeetingPhase } from "@/entities/meeting";
import {
  finalizeRequirementDocument,
  toFinalizeAdviceInput,
  toFinalizeUtteranceLine,
} from "@/entities/requirement-doc";
import type { Utterance } from "@/entities/utterance";
import { useAudioCapture } from "@/features/audio-capture";
import {
  BackendHttpError,
  parseMeetingServerMessage,
  toUserFacingHttpErrorMessage,
} from "@/shared/api";
import { playSoftChime } from "@/shared/lib";
import { createPreviewAdvice, createPreviewUtterances } from "./preview-events";

function isTerminalPhase(phase: MeetingPhase): boolean {
  return phase === "ended" || phase === "finalizing";
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
  title: string;
  preview?: boolean;
}

export type EndMeetingResult =
  { ok: true; preview: boolean } | { ok: false; message: string };

export function useMeetingRoom({
  meetingId,
  title,
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
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const chimeEnabledRef = useRef(true);
  const phaseRef = useRef<MeetingPhase>(preview ? "live" : "idle");
  const utterancesRef = useRef<Utterance[]>(
    preview ? createPreviewUtterances(meetingId) : []
  );
  const adviceItemsRef = useRef<Advice[]>(
    preview ? createPreviewAdvice(meetingId) : []
  );
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
        setUtterances((current) => {
          const next = upsertUtterance(current, {
            id: parsed.id,
            meetingId: parsed.meetingId,
            speaker: parsed.speaker,
            text: parsed.text,
            startMs: parsed.startMs,
            endMs: parsed.endMs,
            isFinal: parsed.isFinal,
            createdAt: parsed.createdAt,
          });
          utterancesRef.current = next;
          return next;
        });
        return;
      case "advice":
        if (seenAdviceIdsRef.current.has(parsed.id)) {
          return;
        }
        seenAdviceIdsRef.current.add(parsed.id);
        setAdviceItems((current) => {
          const next = [
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
          ];
          adviceItemsRef.current = next;
          return next;
        });
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
    if (isTerminalPhase(phaseRef.current)) {
      return;
    }
    const started = await startCapture();
    if (!started || isTerminalPhase(phaseRef.current)) {
      return;
    }
    phaseRef.current = "live";
    setPhase("live");
  }, [startCapture]);

  const handleStop = useCallback(() => {
    if (isTerminalPhase(phaseRef.current)) {
      return;
    }
    stopCapture();
    phaseRef.current = "idle";
    setPhase("idle");
  }, [stopCapture]);

  const endMeeting = useCallback(async (): Promise<EndMeetingResult> => {
    if (phaseRef.current === "finalizing") {
      return { ok: false, message: "要件定義書を生成しています。" };
    }

    phaseRef.current = "finalizing";
    setPhase("finalizing");
    setFinalizeError(null);
    await flushAndDisconnect();

    if (preview) {
      phaseRef.current = "ended";
      setPhase("ended");
      return { ok: true, preview: true };
    }

    try {
      await finalizeRequirementDocument(meetingId, {
        title,
        utterances: utterancesRef.current
          .filter((item) => item.text.trim().length > 0)
          .map((item) => toFinalizeUtteranceLine(item.speaker, item.text)),
        adviceItems: adviceItemsRef.current.map((item) =>
          toFinalizeAdviceInput({
            category: item.category,
            priority: item.priority,
            title: item.title,
            reason: item.reason,
            suggestedQuestion: item.suggestedQuestion,
            quote: item.quote,
            id: item.id,
          })
        ),
      });
      phaseRef.current = "ended";
      setPhase("ended");
      return { ok: true, preview: false };
    } catch (error) {
      const message =
        error instanceof BackendHttpError
          ? error.message
          : toUserFacingHttpErrorMessage("unknown");
      phaseRef.current = "ended";
      setPhase("ended");
      setFinalizeError(message);
      return { ok: false, message };
    }
  }, [flushAndDisconnect, meetingId, preview, title]);

  const handleToggleChime = useCallback((enabled: boolean) => {
    chimeEnabledRef.current = enabled;
    setChimeEnabled(enabled);
  }, []);

  return {
    phase,
    utterances,
    adviceItems,
    chimeEnabled,
    finalizeError,
    audio: state,
    stats,
    startCapture: handleStart,
    stopCapture: handleStop,
    endMeeting,
    toggleChime: handleToggleChime,
  };
}
