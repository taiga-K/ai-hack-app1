"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Advice, AdviceAction } from "@/entities/advice";
import type { MeetingPhase } from "@/entities/meeting";
import {
  applyMindMapEvent,
  createEmptyMindMap,
  type MindMapSnapshot,
} from "@/entities/mind-map";
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
import {
  createPreviewAdvice,
  createPreviewMindMapEvents,
  createPreviewUtterances,
} from "./preview-events";
import {
  applyAdviceAction,
  bindAdviceUndo,
  captureAdviceUndo,
  collectSeenAdviceIds,
  undoAdviceAction,
} from "./resolve-advice";

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
  const laterAdviceItems = preview ? [] : (snapshot?.laterAdviceItems ?? []);
  const resolvedAdviceIds = preview ? [] : (snapshot?.resolvedAdviceIds ?? []);
  return {
    ended,
    utterances,
    adviceItems,
    laterAdviceItems,
    resolvedAdviceIds,
  };
}

export function useMeetingRoom({
  meetingId,
  title,
  preview = false,
  alreadyEnded = false,
}: UseMeetingRoomOptions) {
  const [phase, setPhase] = useState<MeetingPhase>(() =>
    initialPhase(preview, false)
  );
  const [utterances, setUtterances] = useState<Utterance[]>(() =>
    preview ? createPreviewUtterances(meetingId) : []
  );
  const [adviceItems, setAdviceItems] = useState<Advice[]>(() =>
    preview ? createPreviewAdvice(meetingId) : []
  );
  const [laterAdviceItems, setLaterAdviceItems] = useState<Advice[]>([]);
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [mindMap, setMindMap] = useState<MindMapSnapshot>(() =>
    createEmptyMindMap(meetingId)
  );
  const chimeEnabledRef = useRef(true);
  const phaseRef = useRef<MeetingPhase>(initialPhase(preview, false));
  const utterancesRef = useRef<Utterance[]>(utterances);
  const adviceItemsRef = useRef<Advice[]>(adviceItems);
  const laterAdviceItemsRef = useRef<Advice[]>([]);
  const resolvedAdviceIdsRef = useRef<string[]>([]);
  const seenAdviceIdsRef = useRef<Set<string>>(
    collectSeenAdviceIds(adviceItems, [], [])
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const restored = restoreFloor(meetingId, preview, alreadyEnded);
      const nextPhase = initialPhase(preview, restored.ended);
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
      if (preview) {
        return;
      }
      utterancesRef.current = restored.utterances;
      adviceItemsRef.current = restored.adviceItems;
      laterAdviceItemsRef.current = restored.laterAdviceItems;
      resolvedAdviceIdsRef.current = restored.resolvedAdviceIds;
      seenAdviceIdsRef.current = collectSeenAdviceIds(
        restored.adviceItems,
        restored.laterAdviceItems,
        restored.resolvedAdviceIds
      );
      setUtterances(restored.utterances);
      setAdviceItems(restored.adviceItems);
      setLaterAdviceItems(restored.laterAdviceItems);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [alreadyEnded, meetingId, preview]);

  const persistFloor = useCallback(
    (ended: boolean) => {
      writeMeetingFloorSnapshot(meetingId, {
        ended,
        utterances: utterancesRef.current,
        adviceItems: adviceItemsRef.current,
        laterAdviceItems: laterAdviceItemsRef.current,
        resolvedAdviceIds: resolvedAdviceIdsRef.current,
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
        case "mindmap":
          setMindMap((current) =>
            applyMindMapEvent(current, {
              type: "mindmap",
              meetingId: parsed.meetingId,
              revision: parsed.revision,
              upserts: parsed.upserts,
              removes: parsed.removes,
            })
          );
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

  useEffect(() => {
    if (!preview) {
      return;
    }
    const events = createPreviewMindMapEvents(meetingId);
    const timers = events.map((event, index) =>
      window.setTimeout(
        () => {
          setMindMap((current) => applyMindMapEvent(current, event));
        },
        240 + index * 560
      )
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [meetingId, preview]);

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
    if (phaseRef.current === "finalizing") {
      return;
    }
    stopCapture();
    if (phaseRef.current === "ended") {
      return;
    }
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

  const persistAdviceLists = useCallback(
    (active: Advice[], later: Advice[]) => {
      adviceItemsRef.current = active;
      laterAdviceItemsRef.current = later;
      seenAdviceIdsRef.current = collectSeenAdviceIds(
        active,
        later,
        resolvedAdviceIdsRef.current
      );
      setAdviceItems(active);
      setLaterAdviceItems(later);
      persistFloor(isTerminalPhase(phaseRef.current));
    },
    [persistFloor]
  );

  const resolveAdvice = useCallback(
    (adviceId: string, action: AdviceAction): (() => void) | null => {
      const current = {
        active: adviceItemsRef.current,
        later: laterAdviceItemsRef.current,
      };
      const undo = captureAdviceUndo(current, adviceId, action);
      const next = applyAdviceAction(current, adviceId, action);
      if (undo === null) {
        return null;
      }
      switch (action) {
        case "heard":
        case "unneeded":
          if (!resolvedAdviceIdsRef.current.includes(adviceId)) {
            resolvedAdviceIdsRef.current = [
              ...resolvedAdviceIdsRef.current,
              adviceId,
            ];
          }
          break;
        case "later":
          break;
        default: {
          const _exhaustiveCheck: never = action;
          throw new Error(`Unhandled advice action: ${_exhaustiveCheck}`);
        }
      }
      persistAdviceLists(next.active, next.later);
      return bindAdviceUndo(() => {
        switch (undo.action) {
          case "heard":
          case "unneeded":
            resolvedAdviceIdsRef.current = resolvedAdviceIdsRef.current.filter(
              (id) => id !== undo.item.id
            );
            break;
          case "later":
            break;
          default: {
            const _exhaustiveCheck: never = undo.action;
            throw new Error(`Unhandled advice action: ${_exhaustiveCheck}`);
          }
        }
        const restored = undoAdviceAction(
          {
            active: adviceItemsRef.current,
            later: laterAdviceItemsRef.current,
          },
          undo
        );
        persistAdviceLists(restored.active, restored.later);
      });
    },
    [persistAdviceLists]
  );

  const handleToggleChime = useCallback((enabled: boolean) => {
    chimeEnabledRef.current = enabled;
    setChimeEnabled(enabled);
  }, []);

  const reopenLiveFloor = useCallback(() => {
    if (phaseRef.current === "finalizing") {
      return;
    }
    persistFloor(false);
    if (phaseRef.current !== "ended") {
      return;
    }
    phaseRef.current = "idle";
    setPhase("idle");
  }, [persistFloor]);

  return {
    phase,
    utterances,
    adviceItems,
    laterAdviceItems,
    resolveAdvice,
    mindMap,
    chimeEnabled,
    finalizeError,
    audio: state,
    stats,
    startCapture: handleStart,
    stopCapture: handleStop,
    endMeeting,
    toggleChime: handleToggleChime,
    reopenLiveFloor,
  };
}
