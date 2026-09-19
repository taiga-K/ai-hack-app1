import type { AdviceCategory, AdvicePriority } from "@/shared/api";

export interface Advice {
  id: string;
  meetingId: string;
  category: AdviceCategory;
  priority: AdvicePriority;
  title: string;
  reason: string;
  suggestedQuestion: string;
  detectedAt: string;
  quote: string | null;
}
