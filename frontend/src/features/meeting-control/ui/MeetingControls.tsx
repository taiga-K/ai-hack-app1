"use client";

import { useState } from "react";
import {
  Bell,
  BellOff,
  Mic,
  Share2,
  Square,
  StopCircle,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { MeetingPhase } from "@/entities/meeting";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Switch,
} from "@/shared/ui";
import type {
  MeetingConnectionState,
  MeetingStreamStats,
} from "../model/types";

export interface MeetingControlsProps {
  phase: MeetingPhase;
  connection: MeetingConnectionState;
  stats: MeetingStreamStats;
  chimeEnabled: boolean;
  onToggleChime: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onEndMeeting: () => void;
}

function ConnectionBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return <Badge variant={active ? "default" : "secondary"}>{label}</Badge>;
}

export function MeetingControls({
  phase,
  connection,
  stats,
  chimeEnabled,
  onToggleChime,
  onStart,
  onStop,
  onEndMeeting,
}: MeetingControlsProps) {
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const isEnded = phase === "ended";
  const isRequestingPermission = connection.status === "requesting_permission";
  const isCapturing = connection.isRecording && !isEnded;
  const endDisabled = isEnded || isRequestingPermission;

  function handleConfirmEnd() {
    onEndMeeting();
    setEndDialogOpen(false);
  }

  return (
    <section
      aria-label="会議コントロール"
      className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-3 py-2.5 sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {connection.wsStatus === "connected" ? (
          <Badge variant="outline">
            <Wifi data-icon="inline-start" />
            WS接続中
          </Badge>
        ) : connection.wsStatus === "connecting" ? (
          <Badge variant="outline">WS接続試行中</Badge>
        ) : (
          <Badge variant="secondary">
            <WifiOff data-icon="inline-start" />
            WS未接続
          </Badge>
        )}
        <ConnectionBadge
          label="マイク"
          active={connection.hasMicStream && isCapturing}
        />
        <ConnectionBadge
          label="Meet音声"
          active={connection.hasTabStream && isCapturing}
        />
        <Badge
          variant={isEnded ? "secondary" : isCapturing ? "default" : "outline"}
        >
          {isEnded ? "会議終了" : isCapturing ? "録音中" : "待機中"}
        </Badge>
        {isCapturing && (
          <span className="text-[11px] text-muted-foreground">
            {stats.chunksSent.toLocaleString()} chunks
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
          <Mic className="size-3.5 text-muted-foreground" />
          <span className="w-14 shrink-0 text-muted-foreground">自社PM</span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-75"
              style={{ width: `${Math.min(100, connection.micVolume * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
          <Volume2 className="size-3.5 text-muted-foreground" />
          <span className="w-14 shrink-0 text-muted-foreground">相手</span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-75"
              style={{
                width: `${Math.min(100, connection.tabVolume * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isCapturing ? (
          <Button
            onClick={onStart}
            disabled={isEnded || isRequestingPermission}
          >
            <Share2 data-icon="inline-start" />
            {isRequestingPermission ? "権限取得中..." : "キャプチャ開始"}
          </Button>
        ) : (
          <Button variant="outline" onClick={onStop}>
            <Square data-icon="inline-start" />
            キャプチャ停止
          </Button>
        )}

        <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
          <DialogTrigger
            disabled={endDisabled}
            render={<Button variant="destructive" disabled={endDisabled} />}
          >
            <StopCircle data-icon="inline-start" />
            会議終了
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>会議を終了しますか？</DialogTitle>
              <DialogDescription>
                音声キャプチャを停止します。要件定義書プレビューは別タスクで実装します。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEndDialogOpen(false)}>
                キャンセル
              </Button>
              <Button variant="destructive" onClick={handleConfirmEnd}>
                終了する
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="ml-auto flex items-center gap-2">
          {chimeEnabled ? (
            <Bell className="size-3.5 text-muted-foreground" />
          ) : (
            <BellOff className="size-3.5 text-muted-foreground" />
          )}
          <Switch
            id="advice-chime"
            size="sm"
            checked={chimeEnabled}
            onCheckedChange={onToggleChime}
            disabled={isEnded}
          />
          <Label htmlFor="advice-chime" className="text-xs font-normal">
            ピコーン通知
          </Label>
        </div>
      </div>
    </section>
  );
}
