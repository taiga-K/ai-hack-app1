import type { Advice } from "@/entities/advice";
import type { Utterance } from "@/entities/utterance";

export function createPreviewUtterances(meetingId: string): Utterance[] {
  return [
    {
      id: "preview-utt-1",
      meetingId,
      speaker: "local_pm",
      text: "今回の対象範囲は、既存顧客向けの更新申請だけと考えてよいですか？",
      startMs: 4000,
      endMs: 9000,
      isFinal: true,
      createdAt: "2026-09-19T00:00:04.000Z",
    },
    {
      id: "preview-utt-2",
      meetingId,
      speaker: "remote_client",
      text: "はい。API連携でリアルタイムに同期できれば、来月末までに本番投入したいです。",
      startMs: 10000,
      endMs: 17000,
      isFinal: true,
      createdAt: "2026-09-19T00:00:10.000Z",
    },
    {
      id: "preview-utt-3",
      meetingId,
      speaker: "local_pm",
      text: "リアルタイム同期の対象データはどれを想定されていますか？",
      startMs: 18000,
      endMs: 22000,
      isFinal: true,
      createdAt: "2026-09-19T00:00:18.000Z",
    },
    {
      id: "preview-utt-4",
      meetingId,
      speaker: "remote_client",
      text: "了解です。そこはお任せします。",
      startMs: 23000,
      endMs: 26000,
      isFinal: true,
      createdAt: "2026-09-19T00:00:23.000Z",
    },
    {
      id: "preview-utt-5",
      meetingId,
      speaker: "remote_client",
      text: "現場の担当も同じ認識です。例外はあとで共有します。",
      startMs: 27000,
      endMs: 32000,
      isFinal: true,
      createdAt: "2026-09-19T00:00:27.000Z",
    },
    {
      id: "preview-utt-6",
      meetingId,
      speaker: "local_pm",
      text: "では更新申請に限定して、例外は宿題にしますね。",
      startMs: 33000,
      endMs: 37000,
      isFinal: true,
      createdAt: "2026-09-19T00:00:33.000Z",
    },
    {
      id: "preview-utt-7",
      meetingId,
      speaker: "local_pm",
      text: "こちらの設計担当にも、その前提で共有します。",
      startMs: 38000,
      endMs: 42000,
      isFinal: true,
      createdAt: "2026-09-19T00:00:38.000Z",
    },
  ];
}

export function createPreviewAdvice(meetingId: string): Advice[] {
  return [
    {
      id: "preview-adv-jargon",
      meetingId,
      category: "unexplained_jargon",
      priority: "high",
      title: "専門用語が説明なく使われています",
      reason:
        "「API連携」「リアルタイム同期」を未定義のまま、相手が「了解です」と相づちしています。",
      suggestedQuestion:
        "『API連携でリアルタイム同期』は、今ある画面を見るだけですか？ お客様のデータをこちらから書き換えるところまで含みますか？",
      detectedAt: "2026-09-19T00:00:24.000Z",
      quote: "API連携でリアルタイムに同期できれば",
    },
    {
      id: "preview-adv-ambiguity",
      meetingId,
      category: "ambiguity",
      priority: "medium",
      title: "対象範囲がまだ曖昧です",
      reason: "更新申請以外の例外や対象外が会話に出ていません。",
      suggestedQuestion:
        "新規顧客の申請や一括更新は、今回の対象外で間違いないでしょうか？",
      detectedAt: "2026-09-19T00:00:25.000Z",
      quote: "既存顧客向けの更新申請だけ",
    },
    {
      id: "preview-adv-infeasible",
      meetingId,
      category: "infeasibility",
      priority: "high",
      title: "来月末本番は無理がないか確認が必要です",
      reason:
        "リアルタイム同期と本番投入が同時に語られており、前提が未確認です。",
      suggestedQuestion:
        "来月末の本番は、参照のみの暫定連携でも成立しますか？それとも双方向同期が必須ですか？",
      detectedAt: "2026-09-19T00:00:26.000Z",
      quote: "来月末までに本番投入したいです",
    },
  ];
}
