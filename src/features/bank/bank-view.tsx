import { BookMarked, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { CATEGORY_BY_KIND } from "@/components/language/card-props";
import { Callout } from "@/components/lexora/callout";
import { CategoryBadge } from "@/components/lexora/category-badge";
import { EmptyState } from "@/components/lexora/empty-state";
import { HighlightedText } from "@/components/lexora/highlighted-text";
import { StatusBadge } from "@/components/lexora/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { nextReviewText } from "@/learning/status";
import { cn } from "@/lib/utils";
import { bankSection, type BankPage, type BankRow } from "@/server/learning/bank";

import { RemoveButton } from "./remove-button";

const SECTIONS = [
  { id: "ready", title: "Ready to review" },
  { id: "coming", title: "Coming up" },
  { id: "retired", title: "No longer reviewed" },
] as const;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 meanings · 3 due now · 2 new · 5 learning · 2 known": counts as text, not tiles. */
function summary(counts: BankPage["counts"]) {
  return [
    plural(counts.total, "meaning"),
    counts.due ? `${counts.due} due now` : null,
    counts.new ? `${counts.new} new` : null,
    counts.learning ? `${counts.learning} learning` : null,
    counts.known ? `${counts.known} known` : null,
    counts.retired ? `${counts.retired} no longer reviewed` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Row({ row }: { row: BankRow }) {
  const name = row.senseLabel ? `${row.term} (${row.senseLabel})` : row.term;
  return (
    <li data-slot="bank-row" className="flex items-start gap-3 px-3 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {row.href ? (
            <Link
              href={row.href}
              className="rounded-xs type-term-sm text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {row.term}
            </Link>
          ) : (
            <span className="type-term-sm text-foreground">{row.term}</span>
          )}
          <CategoryBadge category={CATEGORY_BY_KIND[row.kind]} variant="dot" />
          {row.senseLabel ? (
            <span className="type-caption text-muted-foreground">{row.senseLabel}</span>
          ) : null}
        </div>
        <p className="mt-1 type-body text-muted-foreground">{row.definition}</p>
        {row.pattern ? (
          <p className="mt-1.5 inline-flex max-w-full rounded-xs bg-muted px-1.5 py-0.5 type-mono text-foreground">
            {row.pattern}
          </p>
        ) : null}
        {row.example ? (
          <p className="mt-1.5 type-example text-foreground">
            <HighlightedText text={row.example.text} spans={row.example.spans} />
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={row.status} />
          {row.nextReview ? (
            <span className="type-caption text-muted-foreground">
              {nextReviewText(row.nextReview)}
            </span>
          ) : null}
          {row.replacement ? (
            <span className="type-caption text-muted-foreground">
              Replaced by{" "}
              <Link
                href={row.replacement.href}
                className="rounded-xs text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {row.replacement.senseLabel
                  ? `${row.replacement.term} (${row.replacement.senseLabel})`
                  : row.replacement.term}
              </Link>
            </span>
          ) : null}
        </div>
      </div>
      <RemoveButton senseId={row.senseId} label={name} />
    </li>
  );
}

function Pagination({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n <= 1 ? "/bank" : `/bank?page=${n}`);
  const shape =
    "inline-flex h-control-md items-center gap-1.5 rounded-md border px-3 type-label max-sm:h-11";
  const link = (n: number, label: string, children: React.ReactNode) =>
    n >= 1 && n <= pages ? (
      <Link
        href={href(n)}
        aria-label={label}
        className={cn(
          shape,
          "border-border bg-card text-foreground transition-colors duration-120 ease-standard outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {children}
      </Link>
    ) : (
      <span aria-hidden className={cn(shape, "border-border text-disabled-foreground")}>
        {children}
      </span>
    );
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {link(
        page - 1,
        `Previous page, page ${page - 1} of ${pages}`,
        <>
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </>,
      )}
      <p className="type-caption text-muted-foreground">
        Page {page} of {pages}
      </p>
      {link(
        page + 1,
        `Next page, page ${page + 1} of ${pages}`,
        <>
          Next
          <ChevronRight aria-hidden className="size-4" />
        </>,
      )}
    </nav>
  );
}

/** The bank's saved language, in sections (specification §17). */
export function BankView({ bank }: { bank: BankPage }) {
  if (bank.counts.total === 0) {
    return (
      <EmptyState
        icon={BookMarked}
        title="Your language bank is empty"
        description="Save a meaning from the Finder and it will appear here, ready to review."
        action={
          <Button asChild>
            <Link href="/finder">Find language</Link>
          </Button>
        }
      />
    );
  }
  // Ready to review: due cards and new saves (§17). Practice picks the ones with an exercise.
  const ready = bank.counts.due + bank.counts.new;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="type-body text-muted-foreground">{summary(bank.counts)}</p>
        {ready > 0 ? (
          <Button asChild>
            <Link href="/practice">
              Start review
              <span className="type-caption opacity-80">{ready} due</span>
            </Link>
          </Button>
        ) : null}
      </div>
      {SECTIONS.map((section) => {
        const rows = bank.rows.filter((row) => bankSection(row.status) === section.id);
        if (rows.length === 0) return null;
        return (
          <section key={section.id} aria-labelledby={`bank-${section.id}`} className="space-y-3">
            <h2 id={`bank-${section.id}`} className="type-heading text-foreground">
              {section.title}
            </h2>
            <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card p-1">
              {rows.map((row) => (
                <Row key={row.senseId} row={row} />
              ))}
            </ul>
          </section>
        );
      })}
      <Pagination page={bank.page} pages={bank.pages} />
    </div>
  );
}

/** The bank couldn't be read: say so, without details, and offer another try. */
export function BankError() {
  return (
    <Callout tone="danger" title="Your language bank isn’t available right now" role="alert">
      <p>Something went wrong on our side. Your saved language is safe; please try again.</p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link href="/bank">Try again</Link>
      </Button>
    </Callout>
  );
}

/** Mirrors the list while it loads. No spinner, no motion. */
export function BankSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading your language bank…</span>
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="space-y-1 rounded-lg border border-border bg-card p-1">
        {[0, 1, 2].map((key) => (
          <div key={key} className="space-y-2 px-3 py-3.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
