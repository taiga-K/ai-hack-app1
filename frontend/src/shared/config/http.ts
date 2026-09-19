const DEFAULT_BACKEND_HTTP_PORT = "8000";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export function resolveBackendHttpOrigin(): string {
  if (typeof window !== "undefined") {
    return "";
  }

  const rewriteOrigin = process.env.BACKEND_HTTP_ORIGIN;
  if (rewriteOrigin && rewriteOrigin.length > 0) {
    return trimTrailingSlash(rewriteOrigin);
  }

  return `http://localhost:${DEFAULT_BACKEND_HTTP_PORT}`;
}

export function getBackendApiUrl(path: string): string {
  const origin = resolveBackendHttpOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

export function getMeetingFinalizeUrl(meetingId: string): string {
  return getBackendApiUrl(
    `/api/v1/meetings/${encodeURIComponent(meetingId)}/finalize`
  );
}

export function getMeetingRequirementsUrl(meetingId: string): string {
  return getBackendApiUrl(
    `/api/v1/meetings/${encodeURIComponent(meetingId)}/requirements`
  );
}

export function getMeetingRequirementsDownloadUrl(meetingId: string): string {
  return getBackendApiUrl(
    `/api/v1/meetings/${encodeURIComponent(meetingId)}/requirements/download`
  );
}
