import type { AdviceCategory, AdvicePriority } from "@/shared/api";

export interface AdviceCategoryPresentation {
  label: string;
  badge: string;
}

export function getAdviceCategoryPresentation(
  category: AdviceCategory
): AdviceCategoryPresentation {
  switch (category) {
    case "ambiguity":
      return { label: "曖昧さを確認", badge: "❓ 曖昧さを確認" };
    case "contradiction":
      return { label: "矛盾を検出", badge: "⚠️ 矛盾を検出" };
    case "infeasibility":
      return { label: "無理・高リスク", badge: "⚠️ 無理を検出" };
    case "missing":
      return { label: "聞き忘れ", badge: "💡 質問提案" };
    case "unexplained_jargon":
      return { label: "専門用語の確認", badge: "❓ 専門用語の確認" };
    case "unknown":
      return { label: "助言", badge: "💡 助言" };
    default: {
      const _exhaustiveCheck: never = category;
      throw new Error(`Unhandled advice category: ${_exhaustiveCheck}`);
    }
  }
}

export function getAdvicePriorityLabel(priority: AdvicePriority): string {
  switch (priority) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default: {
      const _exhaustiveCheck: never = priority;
      throw new Error(`Unhandled advice priority: ${_exhaustiveCheck}`);
    }
  }
}

export function getAdvicePriorityVariant(
  priority: AdvicePriority
): "destructive" | "secondary" | "outline" {
  switch (priority) {
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default: {
      const _exhaustiveCheck: never = priority;
      throw new Error(`Unhandled advice priority: ${_exhaustiveCheck}`);
    }
  }
}
