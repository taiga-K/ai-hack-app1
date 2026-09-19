"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MeetingControls } from "@/features/meeting-control";
import { CopilotSidebar } from "@/widgets/copilot-sidebar";
import { Header } from "@/widgets/header";
import { MeetingFloor } from "@/widgets/meeting-floor";
import { TranscriptFeed } from "@/widgets/transcript-feed";
import { Button, Skeleton, Toaster } from "@/shared/ui";
import { useMeetingRoom } from "../model/use-meeting-room";

export interface MeetingRoomPageProps {
  meetingId: string;
  title?: string;
  preview?: boolean;
}

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
      toast.error(result.message);
      return;
    }
    router.push(buildDocumentHref(meetingId, meetingTitle, result.preview));
  }

  const oursSpeaking = audio.isRecording && audio.micVolume > 0.08;
  const theirsSpeaking = audio.isRecording && audio.tabVolume > 0.08;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <Header title={meetingTitle} badge={preview ? "おためし" : undefined} />

      {audio.errorMessage ? (
        <p className="px-5 text-sm text-destructive sm:px-8" role="alert">
          うまく聞けませんでした。{audio.errorMessage}
        </p>
      ) : null}
      {phase === "finalizing" ? (
        <p className="px-5 text-sm text-muted-foreground sm:px-8">
          まとめを書いています
        </p>
      ) : null}
      {phase === "ended" && finalizeError ? (
        <div className="px-5 sm:px-8" role="alert">
          <p className="text-sm text-destructive">
            まとめを作れませんでした。{finalizeError}
          </p>
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
      {phase === "ended" && !finalizeError ? (
        <p className="px-5 text-sm text-muted-foreground sm:px-8">
          まとめのページへ移ります
        </p>
      ) : null}

      {phase === "finalizing" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-6 sm:px-8">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-4/5 rounded-full" />
          <Skeleton className="min-h-0 flex-1 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pb-2 sm:px-8">
          <div className="min-h-0 shrink-0 lg:max-h-[42%]">
            <MeetingFloor
              oursSpeaking={oursSpeaking}
              theirsSpeaking={theirsSpeaking}
              oursVolume={audio.micVolume}
              theirsVolume={audio.tabVolume}
              whispers={
                <CopilotSidebar
                  adviceItems={adviceItems}
                  onCopied={() => {
                    toast.success("コピーしました");
                  }}
                />
              }
            />
          </div>
          <div className="min-h-0 flex-1">
            <TranscriptFeed utterances={utterances} />
          </div>
        </div>
      )}

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
