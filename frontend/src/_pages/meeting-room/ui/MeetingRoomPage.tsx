"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Advice } from "@/entities/advice";
import type { Utterance } from "@/entities/utterance";
import { MeetingControls } from "@/features/meeting-control";
import { CopilotSidebar } from "@/widgets/copilot-sidebar";
import { Header } from "@/widgets/header";
import { MeetingFloor } from "@/widgets/meeting-floor";
import { TranscriptFeed } from "@/widgets/transcript-feed";
import { Button, Toaster } from "@/shared/ui";
import { useMeetingRoom } from "../model/use-meeting-room";

export interface MeetingRoomPageProps {
  meetingId: string;
  title?: string;
  preview?: boolean;
}

type MobilePane = "notes" | "whispers";
type Handoff = "none" | "making" | "ready";

function buildDocumentHref(
  meetingId: string,
  title: string,
  preview: boolean
): string {
  const params = new URLSearchParams();
  params.set("title", title);
  if (preview) {
    params.set("demo", "1");
  }
  return `/meetings/${meetingId}/document?${params.toString()}`;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function MeetingRoomPage({
  meetingId,
  title,
  preview = false,
}: MeetingRoomPageProps) {
  const router = useRouter();
  const meetingTitle = title?.trim() || "今日の会議";
  const [mobilePane, setMobilePane] = useState<MobilePane>("notes");
  const [handoff, setHandoff] = useState<Handoff>("none");
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
  } = useMeetingRoom({ meetingId, title: meetingTitle, preview });

  async function handleEndMeeting() {
    setHandoff("making");
    const result = await endMeeting();
    if (!result.ok) {
      setHandoff("none");
      return;
    }
    setHandoff("ready");
    await waitMs(780);
    router.push(buildDocumentHref(meetingId, meetingTitle, result.preview));
  }

  const listening = audio.isRecording || (preview && phase === "live");
  const oursSpeaking = listening && audio.micVolume > 0.08;
  const theirsSpeaking = listening && audio.tabVolume > 0.08;
  const showControls = handoff === "none" && phase !== "finalizing";

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
      {!listening && phase === "idle" ? (
        <p className="text-sm text-foreground">
          ききはじめるを押すと、相手の画面の音を共有できます。
        </p>
      ) : null}
      <div className="hidden min-h-0 flex-1 grid-cols-2 gap-8 overflow-hidden lg:grid">
        <CopilotSidebar adviceItems={adviceItems} />
        <TranscriptFeed utterances={utterances} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
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
    </div>
  );

  if (handoff !== "none" || phase === "finalizing") {
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
      <Header title={meetingTitle} badge={preview ? "おためし" : undefined} />

      {audio.errorMessage ? (
        <p className="px-5 text-sm text-destructive sm:px-8" role="alert">
          うまく聞けませんでした。もういちど、ききはじめるを押してください。
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
