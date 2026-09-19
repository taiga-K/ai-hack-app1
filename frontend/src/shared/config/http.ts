const DEFAULT_BACKEND_HTTP_PORT = "8000";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export function resolveBackendHttpOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_HTTP_ORIGIN;
  if (configured && configured.length > 0) {
    return trimTrailingSlash(configured);
  }

  if (typeof window === "undefined") {
    return `http://localhost:${DEFAULT_BACKEND_HTTP_PORT}`;
  }

  const isLocalDevPort =
    window.location.port === "3000" || window.location.port === "3001";

  if (isLocalDevPort) {
    return "";
  }

  return "";
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
