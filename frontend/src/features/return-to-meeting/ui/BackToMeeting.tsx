"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/shared/lib";
import { Button, buttonVariants } from "@/shared/ui";

const LABEL = "戻る";

export type BackToMeetingProps =
  { href: string; onClick?: never } | { href?: never; onClick: () => void };

export function BackToMeeting(props: BackToMeetingProps) {
  const content = (
    <>
      <ChevronLeft data-icon="inline-start" aria-hidden />
      {LABEL}
    </>
  );

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        className={cn(buttonVariants({ variant: "ghost" }))}
      >
        {content}
      </Link>
    );
  }

  return (
    <Button type="button" variant="ghost" onClick={props.onClick}>
      {content}
    </Button>
  );
}
