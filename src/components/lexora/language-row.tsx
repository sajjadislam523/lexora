import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { CategoryBadge } from "./category-badge";
import type { LanguageCategory } from "./language-category";
import { StatusBadge, type LearningStatus } from "./status-badge";

type LanguageRowProps = {
  href: string;
  term: string;
  category: LanguageCategory;
  /** One useful line about how to use it — not a definition. */
  context: string;
  status?: LearningStatus;
  className?: string;
};

/** Compact list item for language: term, kind, one usage line, status. Links to the detail page. */
export function LanguageRow({
  href,
  term,
  category,
  context,
  status,
  className,
}: LanguageRowProps) {
  return (
    <Link
      href={href}
      data-slot="language-row"
      className={cn(
        "group/row flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-120 ease-standard outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="type-term-sm text-foreground">{term}</span>
          <CategoryBadge category={category} variant="dot" />
        </span>
        <span className="mt-0.5 block type-caption text-muted-foreground">{context}</span>
      </span>
      {status ? <StatusBadge status={status} className="max-sm:hidden" /> : null}
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-subtle-foreground transition-transform duration-120 group-hover/row:translate-x-0.5"
      />
    </Link>
  );
}
