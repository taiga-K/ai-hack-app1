"use client";

import { Copy, Download } from "lucide-react";
import { Button, Spinner } from "@/shared/ui";

export interface ExportMarkdownActionsProps {
  copyDisabled?: boolean;
  downloadDisabled?: boolean;
  copying?: boolean;
  downloading?: boolean;
  onCopy: () => void;
  onDownload: () => void;
}

export function ExportMarkdownActions({
  copyDisabled = false,
  downloadDisabled = false,
  copying = false,
  downloading = false,
  onCopy,
  onDownload,
}: ExportMarkdownActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCopy}
        disabled={copyDisabled || copying}
      >
        {copying ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Copy data-icon="inline-start" />
        )}
        Markdownをコピー
      </Button>
      <Button
        type="button"
        onClick={onDownload}
        disabled={downloadDisabled || downloading}
      >
        {downloading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Download data-icon="inline-start" />
        )}
        .mdをダウンロード
      </Button>
    </div>
  );
}
