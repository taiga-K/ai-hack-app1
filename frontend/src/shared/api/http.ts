export type BackendHttpErrorCode =
  | "not_found"
  | "no_transcript"
  | "llm_unconfigured"
  | "generation_failed"
  | "invalid_request"
  | "network"
  | "unknown";

export class BackendHttpError extends Error {
  readonly status: number;
  readonly code: BackendHttpErrorCode;

  constructor(code: BackendHttpErrorCode, message: string, status: number) {
    super(message);
    this.name = "BackendHttpError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readBackendErrorDetail(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const detail = payload.detail;
  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }
        return typeof item.msg === "string" ? item.msg : null;
      })
      .filter((item): item is string => item !== null);
    if (messages.length > 0) {
      return messages.join(" / ");
    }
  }

  return null;
}

export function classifyBackendHttpError(
  status: number,
  detail: string | null
): BackendHttpErrorCode {
  switch (status) {
    case 400:
      return "no_transcript";
    case 404:
      return "not_found";
    case 422:
      return "invalid_request";
    case 502:
      return "generation_failed";
    case 503:
      return "llm_unconfigured";
    default:
      return detail === null ? "unknown" : "unknown";
  }
}

export function toUserFacingHttpErrorMessage(
  code: BackendHttpErrorCode
): string {
  switch (code) {
    case "not_found":
      return "この会議の要件定義書はまだありません。会議を終了して生成してください。";
    case "no_transcript":
      return "発話がまだないため、要件定義書を生成できません。";
    case "llm_unconfigured":
      return "要件定義書の生成サービスが未設定です。";
    case "generation_failed":
      return "要件定義書の生成に失敗しました。もう一度お試しください。";
    case "invalid_request":
      return "要件定義書のリクエスト内容が不正です。";
    case "network":
      return "バックエンドに接続できませんでした。";
    case "unknown":
      return "要件定義書の取得に失敗しました。";
    default: {
      const _exhaustiveCheck: never = code;
      throw new Error(`Unhandled HTTP error code: ${_exhaustiveCheck}`);
    }
  }
}

export async function readResponseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function requestJson(
  url: string,
  init?: RequestInit
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (isAbortError(error)) {
      throw new BackendHttpError(
        "generation_failed",
        toUserFacingHttpErrorMessage("generation_failed"),
        0
      );
    }
    throw new BackendHttpError(
      "network",
      toUserFacingHttpErrorMessage("network"),
      0
    );
  }

  try {
    if (!response.ok) {
      const payload = await readResponseJson(response);
      const detail = readBackendErrorDetail(payload);
      const code = classifyBackendHttpError(response.status, detail);
      throw new BackendHttpError(
        code,
        toUserFacingHttpErrorMessage(code),
        response.status
      );
    }

    return await readResponseJson(response);
  } catch (error) {
    if (isAbortError(error)) {
      throw new BackendHttpError(
        "generation_failed",
        toUserFacingHttpErrorMessage("generation_failed"),
        0
      );
    }
    throw error;
  }
}

export async function requestBlob(url: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new BackendHttpError(
      "network",
      toUserFacingHttpErrorMessage("network"),
      0
    );
  }

  if (!response.ok) {
    const payload = await readResponseJson(response);
    const detail = readBackendErrorDetail(payload);
    const code = classifyBackendHttpError(response.status, detail);
    throw new BackendHttpError(
      code,
      toUserFacingHttpErrorMessage(code),
      response.status
    );
  }

  return response.blob();
}
