"use client";

import { Button } from "@/shared/ui";

export interface ExportMarkdownActionsProps {
  copyDisabled?: boolean;
  downloadDisabled?: boolean;
  copying?: boolean;
  downloading?: boolean;
  onCopy: () => void;
  onDownload: () => void;
}

function CopyMarkdownIcon() {
  return (
    <span className="export-copy-icon" aria-hidden="true">
      <span className="export-copy-icon__back" />
      <span className="export-copy-icon__front" />
    </span>
  );
}

function SaveMarkdownIcon() {
  return (
    <span className="export-save-icon" aria-hidden="true">
      <span className="export-save-icon__arrow" />
      <span className="export-save-icon__tray" />
    </span>
  );
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
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="コピー"
        aria-busy={copying}
        onClick={onCopy}
        disabled={copyDisabled || copying}
      >
        <CopyMarkdownIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="ファイルに保存"
        aria-busy={downloading}
        onClick={onDownload}
        disabled={downloadDisabled || downloading}
      >
        <SaveMarkdownIcon />
      </Button>
    </div>
  );
}
