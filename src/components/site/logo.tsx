import Link from "next/link";

import { cn } from "@/lib/utils";

/** The Lexora wordmark, linking home. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex w-fit items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-sm bg-primary type-micro font-semibold text-primary-foreground"
      >
        L
      </span>
      <span className="type-label text-foreground">Lexora</span>
    </Link>
  );
}
