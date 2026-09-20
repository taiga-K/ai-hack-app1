"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/shared/ui";

const DEFAULT_TITLE = "今日の会議";

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
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(buildMeetingPath(false));
      }}
    >
      <Input
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="今日の会議のなまえ"
        aria-label="今日の会議のなまえ"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" className="flex-1">
          はじめる
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push(buildMeetingPath(true))}
        >
          おためし
        </Button>
      </div>
    </form>
  );
}
