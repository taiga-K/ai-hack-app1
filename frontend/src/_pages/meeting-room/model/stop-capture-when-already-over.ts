export function stopCaptureWhenAlreadyOver(
  alreadyOver: boolean,
  stopCapture: () => void
): void {
  if (!alreadyOver) {
    return;
  }
  stopCapture();
}
