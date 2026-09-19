"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui";
import {
  AlertCircle,
  HelpCircle,
  Mic,
  Radio,
  Share2,
  Square,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAudioCapture } from "../lib/use-audio-capture";

export interface AudioCaptureControlProps {
  meetingId?: string;
  wsBaseUrl?: string;
}

export function AudioCaptureControl({
  meetingId = "sample-meeting",
  wsBaseUrl,
}: AudioCaptureControlProps) {
  const { state, stats, startCapture, stopCapture } = useAudioCapture({
    meetingId,
    wsBaseUrl,
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio
              className={`size-4 ${
                state.isRecording
                  ? "text-emerald-500 animate-pulse"
                  : "text-muted-foreground"
              }`}
            />
            <CardTitle className="text-base font-semibold">
              デュアル音声キャプチャ & リアルタイム配信
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {state.wsStatus === "connected" ? (
              <Badge
                variant="outline"
                className="gap-1 text-xs text-emerald-600"
              >
                <Wifi className="size-3" />
                WebSocket 接続中
              </Badge>
            ) : state.wsStatus === "connecting" ? (
              <Badge variant="outline" className="gap-1 text-xs text-amber-600">
                <Wifi className="size-3 animate-spin" />
                WS 接続試行中
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="gap-1 text-xs text-muted-foreground"
              >
                <WifiOff className="size-3" />
                WS 未接続
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Google Meet タブ音声（相手）とマイク音声（自社）をステレオ 2ch
          に分離して 16kHz PCM 送信します。
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {state.errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>キャプチャエラー</AlertTitle>
            <AlertDescription>{state.errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* チャンネルステータス & ボリュームメーター */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Channel 0: 自社マイク */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5">
                <Mic className="size-3.5 text-primary" />
                Ch 0: 自社マイク (Left)
              </span>
              <Badge
                variant={state.hasMicStream ? "default" : "secondary"}
                className="text-[10px]"
              >
                {state.hasMicStream ? "アクティブ" : "未接続"}
              </Badge>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-75"
                style={{ width: `${Math.min(100, state.micVolume * 100)}%` }}
              />
            </div>
          </div>

          {/* Channel 1: Meet タブ音声 */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5">
                <Volume2 className="size-3.5 text-primary" />
                Ch 1: Meet相手音声 (Right)
              </span>
              <Badge
                variant={state.hasTabStream ? "default" : "secondary"}
                className="text-[10px]"
              >
                {state.hasTabStream ? "アクティブ" : "未接続"}
              </Badge>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-75"
                style={{ width: `${Math.min(100, state.tabVolume * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 送信統計情報 (キャプチャ中のみ) */}
        {state.isRecording && (
          <div className="flex items-center justify-between rounded border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
            <span>
              サンプリングレート: {stats.sampleRate} Hz (16-bit PCM ステレオ)
            </span>
            <span>
              送信チャンク数: {stats.chunksSent.toLocaleString()} 回 (
              {(stats.bytesSent / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}

        {/* 操作ボタン & ガイド */}
        <div className="flex flex-wrap items-center gap-3">
          {!state.isRecording ? (
            <Button
              onClick={startCapture}
              disabled={state.status === "requesting_permission"}
              className="gap-2"
            >
              <Share2 className="size-4" />
              {state.status === "requesting_permission"
                ? "権限取得中..."
                : "Meetタブ音声＋マイクのキャプチャ開始"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={stopCapture}
              className="gap-2"
            >
              <Square className="size-4 fill-current" />
              音声キャプチャ停止
            </Button>
          )}

          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <HelpCircle className="size-4" />
                  接続手順ガイド
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Google Meet 音声の共有手順</DialogTitle>
                <DialogDescription>
                  相手の音声を正確にキャプチャするための手順です。
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground mt-2">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    <strong className="text-foreground">
                      「キャプチャ開始」をクリック
                    </strong>
                    します。
                  </li>
                  <li>
                    ブラウザの共有ダイアログで
                    <strong className="text-foreground">「Chrome タブ」</strong>
                    を選択します。
                  </li>
                  <li>
                    通話中の{" "}
                    <strong className="text-foreground">
                      Google Meet タブ
                    </strong>
                    をクリックします。
                  </li>
                  <li>
                    ダイアログ下部の
                    <strong className="text-foreground">
                      「タブの音声を共有」トグルを必ずON
                    </strong>
                    にして「共有」をクリックします。
                  </li>
                  <li>
                    続いて表示されるマイク許可ダイアログで「許可」を選択します。
                  </li>
                </ol>
                <div className="rounded border border-border p-3 text-xs bg-muted/40">
                  ※ 2chステレオ（左: 自社マイク、右:
                  Meetタブ）で分離エンコードされ、バックエンドで物理的に誤認のない発話者ダイアライゼーションが行われます。
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
