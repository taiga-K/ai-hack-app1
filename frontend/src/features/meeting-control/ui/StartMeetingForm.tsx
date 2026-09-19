"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, PanelsTopLeft } from "lucide-react";
import { Button, Input } from "@/shared/ui";

const DEFAULT_TITLE = "業務ヒアリング";

export function StartMeetingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");

  function buildMeetingPath(preview: boolean): string {
    const meetingId = crypto.randomUUID();
    const params = new URLSearchParams();
    const resolvedTitle = title.trim() || DEFAULT_TITLE;
    params.set("title", resolvedTitle);
    if (preview) {
      params.set("demo", "1");
    }
    return `/meetings/${meetingId}?${params.toString()}`;
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(buildMeetingPath(false));
      }}
    >
      <Input
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="会議名 (例: 〇〇様 要件ヒアリング第1回)"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="flex-1">
          <Mic data-icon="inline-start" />
          セッション開始
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(buildMeetingPath(true))}
        >
          <PanelsTopLeft data-icon="inline-start" />
          UIプレビュー
        </Button>
      </div>
    </form>
  );
}
