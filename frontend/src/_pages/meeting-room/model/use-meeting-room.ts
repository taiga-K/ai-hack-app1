"use client";

import { useCallback, useRef, useState } from "react";
import type { Advice } from "@/entities/advice";
import type { MeetingPhase } from "@/entities/meeting";
import { finalizeRequirementDocument } from "@/entities/requirement-doc";
import type { Utterance } from "@/entities/utterance";
import { useAudioCapture } from "@/features/audio-capture";
import {
  BackendHttpError,
  parseMeetingServerMessage,
  toUserFacingHttpErrorMessage,
} from "@/shared/api";
import { playSoftChime } from "@/shared/lib";
import {
  readMeetingFloorSnapshot,
  writeMeetingFloorSnapshot,
} from "./meeting-floor-snapshot";
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
  alreadyEnded?: boolean;
}

export type EndMeetingResult =
  { ok: true; preview: boolean } | { ok: false; message: string };

function initialPhase(preview: boolean, alreadyEnded: boolean): MeetingPhase {
  if (alreadyEnded) {
    return "ended";
  }
  return preview ? "live" : "idle";
}

function restoreFloor(
  meetingId: string,
  preview: boolean,
  alreadyEnded: boolean
) {
  const snapshot = readMeetingFloorSnapshot(meetingId);
  const ended = alreadyEnded || snapshot?.ended === true;
  const utterances = preview
    ? createPreviewUtterances(meetingId)
    : (snapshot?.utterances ?? []);
  const adviceItems = preview
    ? createPreviewAdvice(meetingId)
    : (snapshot?.adviceItems ?? []);
  return { ended, utterances, adviceItems };
}

export function useMeetingRoom({
  meetingId,
  title,
  preview = false,
  alreadyEnded = false,
}: UseMeetingRoomOptions) {
  const restored = restoreFloor(meetingId, preview, alreadyEnded);
  const [phase, setPhase] = useState<MeetingPhase>(() =>
    initialPhase(preview, restored.ended)
  );
  const [utterances, setUtterances] = useState<Utterance[]>(
    () => restored.utterances
  );
  const [adviceItems, setAdviceItems] = useState<Advice[]>(
    () => restored.adviceItems
  );
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const chimeEnabledRef = useRef(true);
  const phaseRef = useRef<MeetingPhase>(initialPhase(preview, restored.ended));
  const utterancesRef = useRef<Utterance[]>(restored.utterances);
  const adviceItemsRef = useRef<Advice[]>(restored.adviceItems);
  const seenAdviceIdsRef = useRef<Set<string>>(
    new Set(restored.adviceItems.map((item) => item.id))
  );

  const persistFloor = useCallback(
    (ended: boolean) => {
      writeMeetingFloorSnapshot(meetingId, {
        ended,
        utterances: utterancesRef.current,
        adviceItems: adviceItemsRef.current,
      });
    },
    [meetingId]
  );

  const handleServerMessage = useCallback(
    (event: MessageEvent) => {
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
            persistFloor(isTerminalPhase(phaseRef.current));
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
            persistFloor(isTerminalPhase(phaseRef.current));
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
    },
    [persistFloor]
  );

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
      persistFloor(true);
      return { ok: true, preview: true };
    }

    try {
      // Live transcripts/advice are already persisted over WebSocket.
      // Seeding them again would mint new hash ids and duplicate the prompt.
      await finalizeRequirementDocument(meetingId, {
        title,
        utterances: [],
        adviceItems: [],
      });
      phaseRef.current = "ended";
      setPhase("ended");
      persistFloor(true);
      return { ok: true, preview: false };
    } catch (error) {
      const message =
        error instanceof BackendHttpError
          ? error.message
          : toUserFacingHttpErrorMessage("unknown");
      phaseRef.current = "ended";
      setPhase("ended");
      persistFloor(false);
      setFinalizeError(message);
      return { ok: false, message };
    }
  }, [flushAndDisconnect, meetingId, persistFloor, preview, title]);

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
