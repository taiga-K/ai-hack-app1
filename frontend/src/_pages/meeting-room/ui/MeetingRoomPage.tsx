"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Advice } from "@/entities/advice";
import type { Utterance } from "@/entities/utterance";
import { MeetingControls } from "@/features/meeting-control";
import {
  BackToMeeting,
  buildDocumentHref,
  completedSummaryHref,
  decideAfterFinalize,
  decideAfterReadyPause,
  isMeetingAlreadyOver,
  readRememberedCompletedSummary,
  rememberCompletedSummary,
  replaceEndedMeetingUrl,
  type BackTarget,
} from "@/features/return-to-meeting";
import { CopilotSidebar } from "@/widgets/copilot-sidebar";
import { Header } from "@/widgets/header";
import { MeetingFloor } from "@/widgets/meeting-floor";
import { TranscriptFeed } from "@/widgets/transcript-feed";
import { cn } from "@/shared/lib";
import { Button, Toaster, buttonVariants } from "@/shared/ui";
import { useCompletedSummaryLookup } from "../model/use-completed-summary-lookup";
import { useMeetingLayout } from "../model/use-meeting-layout";
import { useMeetingRoom } from "../model/use-meeting-room";

export interface MeetingRoomPageProps {
  meetingId: string;
  title?: string;
  preview?: boolean;
  completedSummaryHint?: boolean;
}

type MobilePane = "notes" | "whispers";
type Handoff = "none" | "making" | "ready";

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function MeetingRoomPage({
  meetingId,
  title,
  preview = false,
  completedSummaryHint = false,
}: MeetingRoomPageProps) {
  const router = useRouter();
  const meetingTitle = title?.trim() || "今日の会議";
  const [mobilePane, setMobilePane] = useState<MobilePane>("notes");
  const [handoff, setHandoff] = useState<Handoff>("none");
  const [sessionDocumentHref, setSessionDocumentHref] = useState<string | null>(
    null
  );
  const stayOnFloorRef = useRef(false);
  const layout = useMeetingLayout();
  const backTarget: BackTarget = {
    kind: "meeting",
    meetingId,
    title: meetingTitle,
    preview,
    hasCompletedSummary: completedSummaryHint,
  };
  const completedSummary = useCompletedSummaryLookup(
    backTarget,
    completedSummaryHint
  );
  const documentHref =
    sessionDocumentHref ?? completedSummaryHref(completedSummary);
  const {
    phase,
    utterances,
    adviceItems,
    chimeEnabled,
    finalizeError,
    audio,
    startCapture,
    stopCapture,
    endMeeting,
    toggleChime,
  } = useMeetingRoom({
    meetingId,
    title: meetingTitle,
    preview,
    alreadyEnded:
      readRememberedCompletedSummary(meetingId) !== null ||
      completedSummary.status === "error",
  });

  async function handleEndMeeting() {
    stayOnFloorRef.current = false;
    setSessionDocumentHref(null);
    setHandoff("making");
    if (preview) {
      await waitMs(720);
    }
    const result = await endMeeting();
    if (!result.ok) {
      setHandoff("none");
      return;
    }
    const nextDocumentHref = buildDocumentHref({
      ...backTarget,
      preview: result.preview,
    });
    setSessionDocumentHref(nextDocumentHref);
    rememberCompletedSummary(
      { ...backTarget, preview: result.preview, hasCompletedSummary: true },
      nextDocumentHref
    );
    replaceEndedMeetingUrl({
      ...backTarget,
      preview: result.preview,
      hasCompletedSummary: true,
    });

    const afterFinalize = decideAfterFinalize(stayOnFloorRef.current);
    switch (afterFinalize) {
      case "stay-on-floor":
        return;
      case "announce-ready":
        setHandoff("ready");
        break;
      default: {
        const _exhaustiveCheck: never = afterFinalize;
        throw new Error(`Unhandled finalize decision: ${_exhaustiveCheck}`);
      }
    }

    await waitMs(780);
    const afterReady = decideAfterReadyPause(stayOnFloorRef.current);
    switch (afterReady) {
      case "stay-on-floor":
        setHandoff("none");
        return;
      case "open-document":
        router.push(nextDocumentHref);
        return;
      default: {
        const _exhaustiveCheck: never = afterReady;
        throw new Error(`Unhandled ready decision: ${_exhaustiveCheck}`);
      }
    }
  }

  function handleBackFromAfterEnd() {
    stayOnFloorRef.current = true;
    setHandoff("none");
  }

  const meetingAlreadyOver = isMeetingAlreadyOver({
    lookupStatus: completedSummary.status,
    hasSessionDocument: documentHref !== null,
    phase,
  });
  const listening =
    !meetingAlreadyOver && (audio.isRecording || (preview && phase === "live"));
  const oursSpeaking = listening && audio.micVolume > 0.08;
  const theirsSpeaking = listening && audio.tabVolume > 0.08;
  const showAfterEnd = handoff === "making" || handoff === "ready";
  const showOpenDocument = documentHref !== null && !showAfterEnd;
  const showControls = !showAfterEnd && !meetingAlreadyOver;

  let workspace = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <MeetingFloor
        oursListening={listening}
        theirsListening={listening}
        oursSpeaking={oursSpeaking}
        theirsSpeaking={theirsSpeaking}
        oursVolume={audio.micVolume}
        theirsVolume={audio.tabVolume}
      />
      {!listening && phase === "idle" && !meetingAlreadyOver ? (
        <p className="text-sm text-foreground">
          ききはじめるを押すと、相手の画面の音を共有できます。
        </p>
      ) : null}
      {layout === "desktop" ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-8 overflow-hidden">
          <CopilotSidebar adviceItems={adviceItems} />
          <TranscriptFeed utterances={utterances} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            role="tablist"
            aria-label="会議の表示"
            className="mb-3 flex flex-wrap gap-2"
          >
            <Button
              type="button"
              size="sm"
              variant={mobilePane === "notes" ? "default" : "outline"}
              role="tab"
              aria-selected={mobilePane === "notes"}
              aria-controls="meeting-mobile-pane"
              onClick={() => setMobilePane("notes")}
            >
              メモ
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mobilePane === "whispers" ? "default" : "outline"}
              role="tab"
              aria-selected={mobilePane === "whispers"}
              aria-controls="meeting-mobile-pane"
              onClick={() => setMobilePane("whispers")}
            >
              {adviceItems.length > 0
                ? `ささやき ${String(adviceItems.length)}`
                : "ささやき"}
            </Button>
          </div>
          <div
            id="meeting-mobile-pane"
            role="tabpanel"
            className="min-h-0 flex-1"
          >
            {renderMobilePane(mobilePane, utterances, adviceItems)}
          </div>
        </div>
      )}
    </div>
  );

  if (showAfterEnd) {
    workspace = (
      <div className="motion-safe:animate-cute-aftertaste flex min-h-0 flex-1 flex-col items-start justify-center gap-2">
        <p className="font-heading text-2xl font-medium">
          {handoff === "ready"
            ? "まとめができました"
            : "まとめをつくっています"}
        </p>
        <p className="text-sm text-foreground">
          {handoff === "ready"
            ? "いまから、出来たまとめを開きます。"
            : "すこし、待っててね。"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <Header
        title={meetingTitle}
        badge={preview ? "おためし" : undefined}
        leading={
          showAfterEnd ? (
            <BackToMeeting onClick={handleBackFromAfterEnd} />
          ) : undefined
        }
        actions={
          showOpenDocument && documentHref !== null ? (
            <Link
              href={documentHref}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              まとめを見る
            </Link>
          ) : undefined
        }
      />

      {audio.errorMessage ? (
        <p className="px-5 text-sm text-destructive sm:px-8" role="alert">
          うまく聞けませんでした。もういちど、ききはじめるを押してください。
        </p>
      ) : null}
      {phase === "finalizing" && !showAfterEnd ? (
        <p className="px-5 text-sm text-foreground sm:px-8">
          まとめをつくっています
        </p>
      ) : null}
      {phase === "ended" && finalizeError ? (
        <div className="px-5 sm:px-8" role="alert">
          <p className="text-sm text-destructive">まとめを作れませんでした。</p>
          <Button
            className="mt-2"
            variant="outline"
            onClick={() => {
              void handleEndMeeting();
            }}
          >
            もういちど
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-2 sm:px-8">
        {workspace}
      </div>

      {showControls ? (
        <div className="px-5 sm:px-8">
          <MeetingControls
            phase={phase}
            connection={audio}
            chimeEnabled={chimeEnabled}
            preview={preview}
            onToggleChime={toggleChime}
            onStart={() => {
              void startCapture();
            }}
            onStop={stopCapture}
            onEndMeeting={() => {
              void handleEndMeeting();
            }}
          />
        </div>
      ) : null}
      <Toaster />
    </div>
  );
}

function renderMobilePane(
  pane: MobilePane,
  utterances: Utterance[],
  adviceItems: Advice[]
) {
  switch (pane) {
    case "notes":
      return <TranscriptFeed utterances={utterances} />;
    case "whispers":
      return <CopilotSidebar adviceItems={adviceItems} />;
    default: {
      const _exhaustiveCheck: never = pane;
      throw new Error(`Unhandled mobile pane: ${_exhaustiveCheck}`);
    }
  }
}
