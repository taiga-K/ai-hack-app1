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
import {
  Button,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Toaster,
} from "@/shared/ui";
import { useMeetingRoom } from "../model/use-meeting-room";

export interface MeetingRoomPageProps {
  meetingId: string;
  title?: string;
  preview?: boolean;
}

type MobilePane = "notes" | "whispers";

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

export function MeetingRoomPage({
  meetingId,
  title,
  preview = false,
}: MeetingRoomPageProps) {
  const router = useRouter();
  const meetingTitle = title?.trim() || "今日の会議";
  const [mobilePane, setMobilePane] = useState<MobilePane>("notes");
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
    const result = await endMeeting();
    if (!result.ok) {
      return;
    }
    router.push(buildDocumentHref(meetingId, meetingTitle, result.preview));
  }

  const listening = audio.isRecording;
  const oursSpeaking = listening && audio.micVolume > 0.08;
  const theirsSpeaking = listening && audio.tabVolume > 0.08;

  function handleMobilePaneChange(next: string[]) {
    const selected = next[0];
    if (selected === "notes" || selected === "whispers") {
      setMobilePane(selected);
    }
  }

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
        <ToggleGroup
          value={[mobilePane]}
          onValueChange={handleMobilePaneChange}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="会議の表示"
          className="mb-3"
        >
          <ToggleGroupItem value="notes" aria-label="会議のメモ">
            メモ
          </ToggleGroupItem>
          <ToggleGroupItem value="whispers" aria-label="ささやき">
            ささやき
            {adviceItems.length > 0 ? ` ${String(adviceItems.length)}` : ""}
          </ToggleGroupItem>
        </ToggleGroup>
        {renderMobilePane(mobilePane, utterances, adviceItems)}
      </div>
    </div>
  );

  if (phase === "finalizing") {
    workspace = (
      <div className="flex min-h-0 flex-1 flex-col gap-3 py-6">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-4/5 rounded-full" />
        <Skeleton className="min-h-0 flex-1 w-full rounded-3xl" />
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

      <div className="px-5 sm:px-8">
        <MeetingControls
          phase={phase}
          connection={audio}
          chimeEnabled={chimeEnabled}
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
