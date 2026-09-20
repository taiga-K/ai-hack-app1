import { getRequirementDocument } from "@/entities/requirement-doc";
import { buildDocumentHref } from "./href";
import type { BackTarget } from "./types";

export async function fetchCompletedDocumentHref(
  target: BackTarget
): Promise<string | null> {
  try {
    await getRequirementDocument(target.meetingId);
    return buildDocumentHref(target);
  } catch {
    return null;
  }
}
