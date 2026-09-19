"use client";

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
        {copying ? <Spinner data-icon="inline-start" /> : null}
        コピー
      </Button>
      <Button
        type="button"
        onClick={onDownload}
        disabled={downloadDisabled || downloading}
      >
        {downloading ? <Spinner data-icon="inline-start" /> : null}
        保存
      </Button>
    </div>
  );
}
