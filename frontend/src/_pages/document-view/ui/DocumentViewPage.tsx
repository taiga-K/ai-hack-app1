"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ExportMarkdownActions } from "@/features/export-markdown";
import { Header } from "@/widgets/header";
import { DocumentEditor, MarkdownPreview } from "@/widgets/document-editor";
import { cn } from "@/shared/lib";
import { Button, Skeleton, Toaster, buttonVariants } from "@/shared/ui";
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
    markdown,
    setMarkdown,
    errorMessage,
    view,
    setView,
    openIssueItems,
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
      toast.success("コピーしました");
      return;
    }
    toast.error("コピーできませんでした");
  }

  async function handleDownload() {
    const downloaded = await downloadMarkdown();
    if (downloaded) {
      toast.success("ファイルに保存しました");
      return;
    }
    toast.error("保存できませんでした");
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <Header
        title={meetingTitle}
        badge={preview ? "おためし" : "できたまとめ"}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-2 sm:px-8">
        <Link
          href={meetingHref}
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          会議に戻る
        </Link>
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
      </div>

      {status === "ready" ? (
        <div className="px-5 pb-2 sm:px-8">
          <p className="text-sm font-medium">あとで確認すること</p>
          {openIssueItems.length === 0 ? (
            <p className="mt-1 text-sm text-foreground">
              確認することは、ありません
            </p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
              {openIssueItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-6 sm:px-8">
          <Skeleton className="h-8 w-48 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-5/6 rounded-full" />
          <Skeleton className="min-h-0 flex-1 w-full rounded-3xl" />
        </div>
      ) : null}

      {status === "empty" ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 px-5 sm:px-8">
          <p className="text-lg font-medium">まとめは、まだ出来ていません</p>
          <p className="text-sm text-muted-foreground">
            {errorMessage ?? "会議をおわると、まとめが出来ます。"}
          </p>
          <Link
            href={meetingHref}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            会議に戻る
          </Link>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 px-5 sm:px-8">
          <p className="text-lg font-medium">まとめを開けませんでした</p>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void reload();
              }}
            >
              もういちど
            </Button>
            <Link
              href={meetingHref}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              会議に戻る
            </Link>
          </div>
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="motion-safe:animate-cute-aftertaste flex min-h-0 flex-1 flex-col">
          <DocumentEditor
            markdown={markdown}
            view={view}
            onMarkdownChange={setMarkdown}
            onViewChange={setView}
            preview={<MarkdownPreview markdown={markdown} key={markdown} />}
          />
        </div>
      ) : null}

      <Toaster />
    </div>
  );
}
