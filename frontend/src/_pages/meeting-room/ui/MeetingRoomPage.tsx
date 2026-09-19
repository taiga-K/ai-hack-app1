"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MeetingControls } from "@/features/meeting-control";
import { CopilotSidebar } from "@/widgets/copilot-sidebar";
import { Header } from "@/widgets/header";
import { TranscriptFeed } from "@/widgets/transcript-feed";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Skeleton,
  Toaster,
} from "@/shared/ui";
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
  const meetingTitle = title?.trim() || "業務ヒアリング";
  const {
    phase,
    utterances,
    adviceItems,
    chimeEnabled,
    finalizeError,
    audio,
    stats,
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

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <Header
        title={meetingTitle}
        badge="自社PM専用"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              Meet横並び向け
            </Badge>
            <Badge variant="secondary">#{meetingId.slice(0, 8)}</Badge>
          </div>
        }
      />
      <MeetingControls
        phase={phase}
        connection={audio}
        stats={stats}
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
      {audio.errorMessage && (
        <Alert variant="destructive" className="mx-3 mt-2 sm:mx-4">
          <AlertTitle>キャプチャエラー</AlertTitle>
          <AlertDescription>{audio.errorMessage}</AlertDescription>
        </Alert>
      )}
      {phase === "finalizing" && (
        <Alert className="mx-3 mt-2 sm:mx-4">
          <AlertTitle>要件定義書を生成しています</AlertTitle>
          <AlertDescription>
            発話と助言を集約しています。完了するとプレビュー画面へ移動します。
          </AlertDescription>
        </Alert>
      )}
      {phase === "ended" && finalizeError && (
        <Alert variant="destructive" className="mx-3 mt-2 sm:mx-4">
          <AlertTitle>要件定義書を生成できませんでした</AlertTitle>
          <AlertDescription>
            <p>{finalizeError}</p>
            <Button
              className="mt-2"
              variant="outline"
              onClick={() => {
                void handleEndMeeting();
              }}
            >
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {phase === "ended" && !finalizeError && (
        <Alert className="mx-3 mt-2 sm:mx-4">
          <AlertTitle>会議を終了しました</AlertTitle>
          <AlertDescription>
            要件定義書プレビューへ移動しています。
          </AlertDescription>
        </Alert>
      )}
      {preview && phase !== "ended" && phase !== "finalizing" && (
        <Alert className="mx-3 mt-2 sm:mx-4">
          <AlertTitle>UIプレビュー</AlertTitle>
          <AlertDescription>
            実音声ではなく表示確認用の発話と助言です。Meetタブ音声＋マイクを接続すると、同じ枠にリアルタイムイベントが流れます。
          </AlertDescription>
        </Alert>
      )}
      {phase === "finalizing" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="min-h-0 flex-1 w-full" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            <TranscriptFeed utterances={utterances} />
          </div>
          <div className="max-h-[46%] min-h-[13rem] w-full shrink-0 border-t border-border lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l">
            <CopilotSidebar
              adviceItems={adviceItems}
              onCopied={() => {
                toast.success("質問文をコピーしました");
              }}
            />
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
