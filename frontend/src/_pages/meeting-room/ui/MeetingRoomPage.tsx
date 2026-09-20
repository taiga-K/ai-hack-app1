"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Advice } from "@/entities/advice";
import type { MindMapSnapshot } from "@/entities/mind-map";
import type { Utterance } from "@/entities/utterance";
import { MeetingControls } from "@/features/meeting-control";
import { CopilotSidebar } from "@/widgets/copilot-sidebar";
import { Header } from "@/widgets/header";
import { MeetingFloor } from "@/widgets/meeting-floor";
import { MindMapCanvas } from "@/widgets/mind-map-canvas";
import { TranscriptFeed } from "@/widgets/transcript-feed";
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
} from "@/shared/ui";
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
}

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
  const [mobilePane, setMobilePane] = useState<MobilePane>("map");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("map");
  const [handoff, setHandoff] = useState<Handoff>("none");
  const layout = useMeetingLayout();
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
  const floorProps = {
    oursListening: listening,
    theirsListening: listening,
    oursSpeaking: oursSpeaking,
    theirsSpeaking: theirsSpeaking,
    oursVolume: audio.micVolume,
    theirsVolume: audio.tabVolume,
  };
  let workspace = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {layout === "mobile" ? <MeetingFloor {...floorProps} /> : null}
      {!listening && phase === "idle" ? (
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
            <div className="flex h-full min-h-0 flex-col gap-3">
              <MeetingFloor {...floorProps} side="ours" />
              <div className="min-h-0 flex-1">
                <CopilotSidebar adviceItems={adviceItems} />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="左右の幅を変える" />
          <ResizablePanel
            id="meeting-workspace"
            className="min-w-0"
            minSize="38"
          >
            <div className="flex h-full min-h-0 flex-col gap-3">
              <MeetingFloor {...floorProps} side="theirs" />
              <div className="min-h-0 flex-1">
                <WorkspaceTabs
                  tab={workspaceTab}
                  onTabChange={setWorkspaceTab}
                  utterances={utterances}
                  mindMap={mindMap}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            role="tablist"
            aria-label="会議の表示"
            className="mb-3 flex flex-wrap gap-2"
          >
            <MobilePaneButton
              pane="map"
              current={mobilePane}
              onSelect={setMobilePane}
            >
              話の地図
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
                ? `ささやき ${String(adviceItems.length)}`
                : "ささやき"}
            </MobilePaneButton>
          </div>
          <div
            className={
              mobilePane === "map"
                ? "min-h-0 flex-1 overflow-hidden"
                : "mb-2 min-h-64 basis-1/2 shrink-0 overflow-hidden"
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
              話の地図を表示しています
            </div>
          )}
        </div>
      )}
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
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <TabsList
        variant="line"
        aria-label="右側の表示"
        className="h-9 w-full justify-start rounded-none border-b border-border bg-transparent px-0"
      >
        <TabsTrigger value="map" className="rounded-none px-3">
          話の地図
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
