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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Separator,
  Toaster,
} from "@/shared/ui";
import { Header } from "@/widgets/header";
import {
  Info,
  Mic,
  MoreVertical,
  Radio,
  Settings,
  Sparkles,
} from "lucide-react";

export function HomePage() {
  return (
    <AppLayout
      header={
        <Header
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 text-xs">
                <Radio className="size-3 text-emerald-500 animate-pulse" />
                Ready
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm">
                      <MoreVertical className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>設定・オプション</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="size-4 mr-2" />
                      環境設定
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Info className="size-4 mr-2" />
                      バージョン情報
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
      }
      sidebar={
        <div className="flex flex-col gap-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            セッション概要
          </div>
          <div className="flex flex-col gap-1 text-sm text-sidebar-foreground">
            <span className="font-medium">業務ヒアリング #1</span>
            <span className="text-xs text-muted-foreground">
              NotionライクUI & Base UI稼働中
            </span>
          </div>
          <Separator />
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            音声ストリーム
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Ch 0: マイク (自社PM)</span>
              <Badge variant="secondary" className="text-[10px]">
                待機中
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Ch 1: Meet (相手)</span>
              <Badge variant="secondary" className="text-[10px]">
                待機中
              </Badge>
            </div>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-4xl p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            リアルタイム要件定義コパイロット
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Google
            Meetの会話を自律監視し、曖昧・矛盾・無理を検出して要件定義書をリアルタイム生成します。
          </p>
        </div>

        <Alert>
          <Sparkles className="size-4 text-primary" />
          <AlertTitle>shadcn/ui (Base UI版) デザインシステム稼働中</AlertTitle>
          <AlertDescription>
            Radix UIではなく @base-ui/react
            を基盤とし、renderプロパティによる合成とNotionライクな落ち着いたグレーパレットを採用しています。
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="size-4" />
                クイックスタート
              </CardTitle>
              <CardDescription>ヒアリングセッションの開始準備</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input placeholder="会議名 (例: 〇〇様 要件ヒアリング第1回)" />
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Mic className="size-4 mr-1.5" />
                  セッション開始
                </Button>
                <Dialog>
                  <DialogTrigger
                    render={<Button variant="outline">ヘルプ</Button>}
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>コパイロットの使い方</DialogTitle>
                      <DialogDescription>
                        自社マイクとGoogle
                        Meetタブ音声を同時にキャプチャし、リアルタイムに助言と議事録を作成します。
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">デザインシステム検証</CardTitle>
              <CardDescription>
                導入済みプリミティブ（Base UI準拠）
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 items-center">
              <Button size="sm" variant="default">
                Default
              </Button>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="outline">
                Outline
              </Button>
              <Button size="sm" variant="ghost">
                Ghost
              </Button>
              <Badge variant="default">Badge</Badge>
              <Badge variant="secondary">Neutral</Badge>
              <Badge variant="outline">Outline</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster />
    </AppLayout>
  );
}
