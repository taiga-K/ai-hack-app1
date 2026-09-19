export function getMarkdownDownloadFilename(meetingId: string): string {
  return `requirements-${meetingId}.md`;
}

export function downloadMarkdownText(filename: string, markdown: string): void {
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
