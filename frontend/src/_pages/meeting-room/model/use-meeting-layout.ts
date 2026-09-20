"use client";

import { useEffect, useState } from "react";

export type MeetingLayout = "desktop" | "mobile";

export function useMeetingLayout(): MeetingLayout | null {
  const [layout, setLayout] = useState<MeetingLayout | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setLayout(media.matches ? "desktop" : "mobile");
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  return layout;
}
