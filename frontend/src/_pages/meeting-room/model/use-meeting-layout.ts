"use client";

import { useLayoutEffect, useState } from "react";

export type MeetingLayout = "desktop" | "mobile";

export function useMeetingLayout(): MeetingLayout {
  const [layout, setLayout] = useState<MeetingLayout>("desktop");

  useLayoutEffect(() => {
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
