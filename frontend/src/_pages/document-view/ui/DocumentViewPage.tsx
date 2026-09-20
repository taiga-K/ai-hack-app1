"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { ExportMarkdownActions } from "@/features/export-markdown";
import {
  BackToMeeting,
  buildDocumentHref,
  buildMeetingHref,
  rememberCompletedSummary,
  shouldHintCompletedSummaryOnBack,
  type BackTarget,
} from "@/features/return-to-meeting";
import { Header } from "@/widgets/header";
import { DocumentEditor, MarkdownPreview } from "@/widgets/document-editor";
import { Button, Skeleton, Toaster } from "@/shared/ui";
import { useDocumentView } from "../model/use-document-view";

export interface DocumentViewPageProps {
  meetingId: string;
  title?: string;
  preview?: boolean;
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

  const backTarget: BackTarget = {
    kind: "meeting",
    meetingId,
    title: meetingTitle,
    preview,
    hasCompletedSummary: shouldHintCompletedSummaryOnBack(status),
  };
  const meetingHref = buildMeetingHref(backTarget);

  useEffect(() => {
    if (!shouldHintCompletedSummaryOnBack(status)) {
      return;
    }
    const rememberedTarget: BackTarget = {
      kind: "meeting",
      meetingId,
      title: meetingTitle,
      preview,
      hasCompletedSummary: true,
    };
    rememberCompletedSummary(
      rememberedTarget,
      buildDocumentHref(rememberedTarget)
    );
  }, [meetingId, meetingTitle, preview, status]);

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
        leading={<BackToMeeting href={meetingHref} />}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-2 sm:px-8">
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
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 px-5 sm:px-8">
          <p className="text-lg font-medium">まとめを開けませんでした</p>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button
            onClick={() => {
              void reload();
            }}
          >
            もういちど
          </Button>
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="motion-safe:animate-cute-aftertaste flex min-h-0 flex-1 flex-col">
          <DocumentEditor
            markdown={markdown}
            view={view}
            onMarkdownChange={setMarkdown}
            onViewChange={setView}
            preview={<MarkdownPreview markdown={markdown} />}
          />
        </div>
      ) : null}

      <Toaster />
    </div>
  );
}
