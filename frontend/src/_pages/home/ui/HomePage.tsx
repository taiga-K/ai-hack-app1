import { StartMeetingForm } from "@/features/meeting-control";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  AppLayout,
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
  Separator,
  Toaster,
} from "@/shared/ui";
import { Header } from "@/widgets/header";
import { Info, Radio, Sparkles } from "lucide-react";

export function HomePage() {
  return (
    <AppLayout
      header={
        <Header
          actions={
            <Badge variant="outline" className="gap-1 text-xs">
              <Radio className="size-3 text-primary" />
              Ready
            </Badge>
          }
        />
      }
      sidebar={
        <div className="flex flex-col gap-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            セッション概要
          </div>
          <div className="flex flex-col gap-1 text-sm text-sidebar-foreground">
            <span className="font-medium">業務ヒアリング</span>
            <span className="text-xs text-muted-foreground">
              自社PM専用の会議コパイロット
            </span>
          </div>
          <Separator />
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            音声ストリーム仕様
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Ch 0 (Left): 自社PM</span>
              <Badge variant="outline" className="text-[10px]">
                マイク
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Ch 1 (Right): 相手</span>
              <Badge variant="outline" className="text-[10px]">
                Meet音声
              </Badge>
            </div>
          </div>
        </div>
      }
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            リアルタイム要件定義コパイロット
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Google
            Meetの会話を自律監視し、曖昧・矛盾・無理・専門用語の取り違えを自社画面だけに助言します。
          </p>
        </div>

        <Alert>
          <Sparkles />
          <AlertTitle>自社PM画面のみに助言します</AlertTitle>
          <AlertDescription>
            相手のMeet画面には何も出しません。会議ルームで文字起こしと横からのピコーン通知を確認できます。
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>ヒアリングを開始</CardTitle>
            <CardDescription>
              Meetの横に並べて使える会議ルームを開きます
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StartMeetingForm />
            <Dialog>
              <DialogTrigger render={<Button variant="ghost" size="sm" />}>
                <Info data-icon="inline-start" />
                接続手順
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Google Meet 横並びの使い方</DialogTitle>
                  <DialogDescription>
                    ブラウザウィンドウをMeetの横に置き、キャプチャ開始からタブ音声共有をONにしてください。
                  </DialogDescription>
                </DialogHeader>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
                  <li>セッション開始で会議ルームを開きます。</li>
                  <li>
                    「キャプチャ開始」から Chrome タブ → Meet タブを選びます。
                  </li>
                  <li>「タブの音声を共有」をONにして共有します。</li>
                  <li>マイク許可後、助言は右側にだけ表示されます。</li>
                </ol>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </AppLayout>
  );
}
