import { requestBlob, requestJson } from "@/shared/api";
import {
  getMeetingFinalizeUrl,
  getMeetingRequirementsDownloadUrl,
  getMeetingRequirementsUrl,
} from "@/shared/config";
import {
  parseRequirementDocument,
  toFinalizeRequestBody,
} from "../model/parse";
import type {
  FinalizeRequirementDocumentInput,
  RequirementDocument,
} from "../model/types";

export class RequirementDocumentParseError extends Error {
  constructor() {
    super("要件定義書の応答形式が不正です。");
    this.name = "RequirementDocumentParseError";
  }
}

async function parseDocumentResponse(
  payload: unknown
): Promise<RequirementDocument> {
  const document = parseRequirementDocument(payload);
  if (document === null) {
    throw new RequirementDocumentParseError();
  }
  return document;
}

export async function finalizeRequirementDocument(
  meetingId: string,
  input: FinalizeRequirementDocumentInput,
  options?: { signal?: AbortSignal }
): Promise<RequirementDocument> {
  const payload = await requestJson(getMeetingFinalizeUrl(meetingId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toFinalizeRequestBody(input)),
    signal: options?.signal,
  });
  return parseDocumentResponse(payload);
}

export async function getRequirementDocument(
  meetingId: string
): Promise<RequirementDocument> {
  const payload = await requestJson(getMeetingRequirementsUrl(meetingId), {
    method: "GET",
  });
  return parseDocumentResponse(payload);
}

export async function downloadRequirementDocumentBlob(
  meetingId: string
): Promise<Blob> {
  return requestBlob(getMeetingRequirementsDownloadUrl(meetingId));
}

export function getRequirementDownloadFilename(meetingId: string): string {
  return `requirements-${meetingId}.md`;
}
