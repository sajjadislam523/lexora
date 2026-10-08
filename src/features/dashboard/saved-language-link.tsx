import { BookMarked } from "lucide-react";
import Link from "next/link";

/** How many meanings the learner has saved — counted in the database on the server. */
export function SavedLanguageLink({ count }: { count: number }) {
  return (
    <Link
      href="/bank"
      className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-120 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BookMarked aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block type-label text-foreground">Open language bank</span>
        <span className="block type-caption text-muted-foreground">
          {count} {count === 1 ? "meaning" : "meanings"} saved
        </span>
      </span>
    </Link>
  );
}
