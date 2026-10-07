import Link from "next/link";

import { FEATURED_SEARCHES, searchHref } from "@/language/examples";
import { cn } from "@/lib/utils";

/** The featured example searches as links into Explore. */
export function ExampleLinks({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="mr-1 type-caption text-subtle-foreground">Try</span>
      {FEATURED_SEARCHES.map((search) => (
        <Link
          key={search.id}
          href={searchHref("/explore", search.text)}
          className="rounded-full bg-muted px-2.5 py-1 type-caption text-muted-foreground transition-colors duration-120 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {search.text}
        </Link>
      ))}
    </div>
  );
}
