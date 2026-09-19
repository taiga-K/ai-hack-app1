"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CircleAlert, FileText } from "lucide-react";
import { ExportMarkdownActions } from "@/features/export-markdown";
import { Header } from "@/widgets/header";
import { DocumentEditor, MarkdownPreview } from "@/widgets/document-editor";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  Toaster,
} from "@/shared/ui";
import { useDocumentView } from "../model/use-document-view";

export interface DocumentViewPageProps {
  meetingId: string;
  title?: string;
  preview?: boolean;
}

function buildMeetingHref(
  meetingId: string,
  title: string,
  preview: boolean
): string {
  const params = new URLSearchParams();
  params.set("title", title);
  if (preview) {
    params.set("demo", "1");
  }
  return `/meetings/${meetingId}?${params.toString()}`;
}

export function DocumentViewPage({
  meetingId,
  title,
  preview = false,
}: DocumentViewPageProps) {
  const {
    meetingTitle,
    status,
    document,
    markdown,
    setMarkdown,
    errorMessage,
    view,
    setView,
    openIssues,
    showOpenIssuesCallout,
    copying,
    downloading,
    reload,
    copyMarkdown,
    downloadMarkdown,
  } = useDocumentView({ meetingId, title, preview });

  const meetingHref = buildMeetingHref(meetingId, meetingTitle, preview);

  async function handleCopy() {
    const copied = await copyMarkdown();
    if (copied) {
      toast.success("Markdownをコピーしました");
      return;
    }
    toast.error("コピーできませんでした");
  }

  async function handleDownload() {
    const downloaded = await downloadMarkdown();
    if (downloaded) {
      toast.success("Markdownファイルを保存しました");
      return;
    }
    toast.error("ダウンロードできませんでした");
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <Header
        title={meetingTitle}
        badge="要件定義書"
        actions={
          <div className="flex items-center gap-2">
            {preview && <Badge variant="outline">UIプレビュー</Badge>}
            <Badge variant="secondary">#{meetingId.slice(0, 8)}</Badge>
          </div>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2.5 sm:px-4">
        <Button variant="outline" render={<Link href={meetingHref} />}>
          <ArrowLeft data-icon="inline-start" />
          会議に戻る
        </Button>
        <ExportMarkdownActions
          copyDisabled={status !== "ready" || markdown.length === 0}
          downloadDisabled={status !== "ready" || markdown.length === 0}
          copying={copying}
          downloading={downloading}
          onCopy={() => {
            void handleCopy();
          }}
          onDownload={() => {
            void handleDownload();
          }}
        />
        {document && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            発話 {document.sourceUtteranceCount} / 検出{" "}
            {document.sourceDetectionCount}
          </span>
        )}
      </div>

      {preview && status === "ready" && (
        <Alert className="mx-3 mt-2 sm:mx-4">
          <AlertTitle>表示確認用の要件定義書です</AlertTitle>
          <AlertDescription>
            実会議の生成結果ではなく、プレビュー／コピー／ダウンロードの操作確認用です。
          </AlertDescription>
        </Alert>
      )}

      {showOpenIssuesCallout && openIssues && (
        <Alert className="mx-3 mt-2 sm:mx-4">
          <CircleAlert />
          <AlertTitle>未決事項（ToDo）があります</AlertTitle>
          <AlertDescription>
            <p className="mb-1">{openIssues.heading}</p>
            <div className="whitespace-pre-wrap text-sm">
              {openIssues.bodyMarkdown}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {status === "loading" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="min-h-0 flex-1 w-full" />
        </div>
      )}

      {status === "empty" && (
        <Empty className="min-h-0 flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>要件定義書がまだありません</EmptyTitle>
            <EmptyDescription>
              {errorMessage ??
                "会議を終了すると、発話から要件定義書が生成されます。"}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" render={<Link href={meetingHref} />}>
              会議に戻る
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {status === "error" && (
        <Empty className="min-h-0 flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlert />
            </EmptyMedia>
            <EmptyTitle>要件定義書を表示できません</EmptyTitle>
            <EmptyDescription>{errorMessage}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() => {
                void reload();
              }}
            >
              再読み込み
            </Button>
            <Button variant="outline" render={<Link href={meetingHref} />}>
              会議に戻る
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {status === "ready" && (
        <DocumentEditor
          markdown={markdown}
          view={view}
          onMarkdownChange={setMarkdown}
          onViewChange={setView}
          preview={<MarkdownPreview markdown={markdown} />}
        />
      )}

      <Toaster />
    </div>
  );
}
