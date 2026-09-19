"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendHttpError, toUserFacingHttpErrorMessage } from "@/shared/api";
import {
  downloadRequirementDocumentBlob,
  findOpenIssuesSection,
  getRequirementDocument,
  hasConcreteOpenIssues,
  type RequirementDocument,
} from "@/entities/requirement-doc";
import {
  downloadBlob,
  downloadMarkdownText,
  getMarkdownDownloadFilename,
} from "@/features/export-markdown";
import { copyTextToClipboard } from "@/shared/lib";
import type { DocumentEditorView } from "@/widgets/document-editor";
import { createPreviewRequirementDocument } from "./preview-document";

export type DocumentViewStatus = "loading" | "ready" | "empty" | "error";

export interface UseDocumentViewOptions {
  meetingId: string;
  title?: string;
  preview?: boolean;
}

function createInitialDocument(
  meetingId: string,
  meetingTitle: string,
  preview: boolean
): RequirementDocument | null {
  if (!preview) {
    return null;
  }
  return createPreviewRequirementDocument(meetingId, meetingTitle);
}

export function useDocumentView({
  meetingId,
  title,
  preview = false,
}: UseDocumentViewOptions) {
  const meetingTitle = title?.trim() || "業務ヒアリング";
  const [status, setStatus] = useState<DocumentViewStatus>(() =>
    preview ? "ready" : "loading"
  );
  const [document, setDocument] = useState<RequirementDocument | null>(() =>
    createInitialDocument(meetingId, meetingTitle, preview)
  );
  const [markdown, setMarkdown] = useState(() => {
    const initial = createInitialDocument(meetingId, meetingTitle, preview);
    return initial?.markdown ?? "";
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [view, setView] = useState<DocumentEditorView>("split");
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const applyDocument = useCallback((next: RequirementDocument) => {
    setDocument(next);
    setMarkdown(next.markdown);
    setErrorMessage(null);
    setStatus("ready");
  }, []);

  const loadFromApi = useCallback(async () => {
    try {
      const next = await getRequirementDocument(meetingId);
      applyDocument(next);
    } catch (error) {
      if (error instanceof BackendHttpError && error.code === "not_found") {
        setDocument(null);
        setMarkdown("");
        setStatus("empty");
        setErrorMessage(error.message);
        return;
      }

      const message =
        error instanceof BackendHttpError
          ? error.message
          : toUserFacingHttpErrorMessage("unknown");
      setDocument(null);
      setMarkdown("");
      setStatus("error");
      setErrorMessage(message);
    }
  }, [applyDocument, meetingId]);

  const reload = useCallback(async () => {
    if (preview) {
      applyDocument(createPreviewRequirementDocument(meetingId, meetingTitle));
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    await loadFromApi();
  }, [applyDocument, loadFromApi, meetingId, meetingTitle, preview]);

  useEffect(() => {
    if (preview) {
      return;
    }

    let cancelled = false;

    void getRequirementDocument(meetingId)
      .then((next) => {
        if (cancelled) {
          return;
        }
        applyDocument(next);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof BackendHttpError && error.code === "not_found") {
          setDocument(null);
          setMarkdown("");
          setStatus("empty");
          setErrorMessage(error.message);
          return;
        }

        const message =
          error instanceof BackendHttpError
            ? error.message
            : toUserFacingHttpErrorMessage("unknown");
        setDocument(null);
        setMarkdown("");
        setStatus("error");
        setErrorMessage(message);
      });

    return () => {
      cancelled = true;
    };
  }, [applyDocument, meetingId, preview]);

  const openIssues = useMemo(
    () => (document ? findOpenIssuesSection(document) : null),
    [document]
  );
  const showOpenIssuesCallout = hasConcreteOpenIssues(openIssues);

  const copyMarkdown = useCallback(async (): Promise<boolean> => {
    if (markdown.length === 0) {
      return false;
    }
    setCopying(true);
    const copied = await copyTextToClipboard(markdown);
    setCopying(false);
    return copied;
  }, [markdown]);

  const downloadMarkdown = useCallback(async (): Promise<boolean> => {
    const filename = getMarkdownDownloadFilename(meetingId);
    setDownloading(true);
    try {
      if (preview || document === null) {
        downloadMarkdownText(filename, markdown);
        return true;
      }

      const isEdited = markdown !== document.markdown;
      if (isEdited) {
        downloadMarkdownText(filename, markdown);
        return true;
      }

      const blob = await downloadRequirementDocumentBlob(meetingId);
      downloadBlob(filename, blob);
      return true;
    } catch {
      if (markdown.length > 0) {
        downloadMarkdownText(filename, markdown);
        return true;
      }
      return false;
    } finally {
      setDownloading(false);
    }
  }, [document, markdown, meetingId, preview]);

  return {
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
  };
}
