"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Advice } from "@/entities/advice";
import type { MindMapSnapshot } from "@/entities/mind-map";
import type { Utterance } from "@/entities/utterance";
import { MeetingControls } from "@/features/meeting-control";
import {
  BackToMeeting,
  buildDocumentHref,
  completedSummaryHref,
  decideAfterFinalize,
  decideAfterReadyPause,
  isMeetingAlreadyOver,
  rememberCompletedSummary,
  useRememberedCompletedSummary,
  replaceEndedMeetingUrl,
  shouldReopenLiveFloor,
  type BackTarget,
} from "@/features/return-to-meeting";
import { CopilotSidebar } from "@/widgets/copilot-sidebar";
import { Header } from "@/widgets/header";
import { MindMapCanvas } from "@/widgets/mind-map-canvas";
import { TranscriptFeed } from "@/widgets/transcript-feed";
import { cn } from "@/shared/lib";
import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
  buttonVariants,
} from "@/shared/ui";
import { stopCaptureWhenAlreadyOver } from "../model/stop-capture-when-already-over";
import { useCompletedSummaryLookup } from "../model/use-completed-summary-lookup";
import { useMeetingLayout } from "../model/use-meeting-layout";
import { useMeetingRoom } from "../model/use-meeting-room";
import {
  MEETING_SPLIT,
  isMobileSidePane,
  isWorkspaceTab,
  type MobilePane,
  type MobileSidePane,
  type WorkspaceTab,
} from "../model/workspace";

export interface MeetingRoomPageProps {
  meetingId: string;
  title?: string;
  preview?: boolean;
  completedSummaryHint?: boolean;
}

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
  const [mobilePane, setMobilePane] = useState<MobilePane>("map");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("map");
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
  const rememberedCompletedSummary = useRememberedCompletedSummary(meetingId);
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
    mindMap,
    chimeEnabled,
    finalizeError,
    audio,
    startCapture,
    stopCapture,
    endMeeting,
    toggleChime,
    reopenLiveFloor,
  } = useMeetingRoom({
    meetingId,
    title: meetingTitle,
    preview,
    alreadyEnded: rememberedCompletedSummary !== null,
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
  useEffect(() => {
    if (
      !shouldReopenLiveFloor({
        lookupStatus: completedSummary.status,
        hasSessionDocument: sessionDocumentHref !== null,
        hasFinalizeError: finalizeError !== null,
        phase,
      })
    ) {
      return;
    }
    reopenLiveFloor();
  }, [
    completedSummary.status,
    finalizeError,
    phase,
    reopenLiveFloor,
    sessionDocumentHref,
  ]);
  useEffect(() => {
    stopCaptureWhenAlreadyOver(completedSummary.status, phase, stopCapture);
  }, [completedSummary.status, phase, stopCapture]);
  const listening =
    !meetingAlreadyOver && (audio.isRecording || (preview && phase === "live"));
  const showAfterEnd = handoff === "making" || handoff === "ready";
  const showOpenDocument = documentHref !== null && !showAfterEnd;
  const showControls =
    !showAfterEnd && !meetingAlreadyOver && finalizeError === null;
  let workspace = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {!listening && phase === "idle" && !meetingAlreadyOver ? (
        <p className="text-sm text-foreground">
          ききはじめるを押すと、相手の画面の音を共有できます。
        </p>
      ) : null}
      {layout === "desktop" ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1 overflow-hidden"
        >
          <ResizablePanel
            id="meeting-whispers"
            defaultSize={MEETING_SPLIT.leftDefault}
            minSize={MEETING_SPLIT.leftMin}
            maxSize={MEETING_SPLIT.leftMax}
            className="min-w-0"
          >
            <CopilotSidebar adviceItems={adviceItems} />
          </ResizablePanel>
          <ResizableHandle aria-label="左右の幅を変える" />
          <ResizablePanel
            id="meeting-workspace"
            className="min-w-0"
            minSize="38"
          >
            <WorkspaceTabs
              tab={workspaceTab}
              onTabChange={setWorkspaceTab}
              utterances={utterances}
              mindMap={mindMap}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            role="tablist"
            aria-label="会議の表示"
            className="mb-6 flex flex-wrap gap-2"
          >
            <MobilePaneButton
              pane="map"
              current={mobilePane}
              onSelect={setMobilePane}
            >
              マインドマップ
            </MobilePaneButton>
            <MobilePaneButton
              pane="notes"
              current={mobilePane}
              onSelect={setMobilePane}
            >
              メモ
            </MobilePaneButton>
            <MobilePaneButton
              pane="whispers"
              current={mobilePane}
              onSelect={setMobilePane}
            >
              {adviceItems.length > 0
                ? `アドバイス ${String(adviceItems.length)}`
                : "アドバイス"}
            </MobilePaneButton>
          </div>
          <div
            className={
              mobilePane === "map"
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "mb-2 flex min-h-[24rem] basis-3/5 shrink-0 flex-col overflow-hidden"
            }
          >
            <MindMapCanvas snapshot={mindMap} compact />
          </div>
          {isMobileSidePane(mobilePane) ? (
            <div
              id="meeting-mobile-pane"
              role="tabpanel"
              className="min-h-0 flex-1 overflow-hidden"
            >
              {renderMobileSidePane(mobilePane, utterances, adviceItems)}
            </div>
          ) : (
            <div id="meeting-mobile-pane" role="tabpanel" className="sr-only">
              マインドマップを表示しています
            </div>
          )}
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

function WorkspaceTabs({
  tab,
  onTabChange,
  utterances,
  mindMap,
}: {
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  utterances: Utterance[];
  mindMap: MindMapSnapshot;
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (typeof value === "string" && isWorkspaceTab(value)) {
          onTabChange(value);
        }
      }}
      className="flex h-full min-h-0 flex-col gap-6"
    >
      <TabsList
        variant="line"
        aria-label="右側の表示"
        className="h-9 w-full justify-start rounded-none border-b border-border bg-transparent px-0"
      >
        <TabsTrigger value="map" className="rounded-none px-3">
          マインドマップ
        </TabsTrigger>
        <TabsTrigger value="notes" className="rounded-none px-3">
          会議のメモ
        </TabsTrigger>
      </TabsList>
      <TabsContent value="map" className="min-h-0 overflow-hidden">
        <MindMapCanvas snapshot={mindMap} />
      </TabsContent>
      <TabsContent value="notes" className="min-h-0 overflow-hidden">
        <TranscriptFeed utterances={utterances} />
      </TabsContent>
    </Tabs>
  );
}

function MobilePaneButton({
  pane,
  current,
  onSelect,
  children,
}: {
  pane: MobilePane;
  current: MobilePane;
  onSelect: (pane: MobilePane) => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={current === pane ? "default" : "outline"}
      role="tab"
      aria-selected={current === pane}
      aria-controls="meeting-mobile-pane"
      onClick={() => onSelect(pane)}
    >
      {children}
    </Button>
  );
}

function renderMobileSidePane(
  pane: MobileSidePane,
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
