import Link from "next/link";
import { cn } from "@/shared/lib";
import { buttonVariants } from "@/shared/ui";

export function GoHome() {
  return (
    <Link
      href="/"
      className={cn(
        buttonVariants({ variant: "default", size: "lg" }),
        "cursor-pointer"
      )}
    >
      ホーム
    </Link>
  );
}
