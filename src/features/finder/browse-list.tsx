"use client";

import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { CATEGORY_BY_KIND } from "@/components/language/card-props";
import { LanguageRow } from "@/components/lexora/language-row";
import { finderHref, type FinderState } from "@/language/filters";
import { languageHref } from "@/language/links";
import type { BrowseResponse } from "@/language/search/types";
import { cn } from "@/lib/utils";

type BasePath = "/finder" | "/explore";

/**
 * Browsing by filters without a query: the engine's matching senses, core IELTS language first,
 * then A–Z, 30 per page. Rows link to the meaning on its language page. Changing page moves focus
 * to the list heading, so the new page is read from the top.
 */
export function BrowseList({
  basePath,
  url,
  response,
}: {
  basePath: BasePath;
  url: FinderState;
  response: BrowseResponse;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const shownPage = useRef(response.page);
  useEffect(() => {
    if (shownPage.current === response.page) return;
    shownPage.current = response.page;
    heading.current?.focus();
  }, [response.page]);

  if (response.total === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
        <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <SearchX aria-hidden className="size-4.5" />
        </span>
        <h2 className="type-subheading text-foreground">No language matches these filters yet</h2>
        <p className="mt-1 max-w-md type-body text-muted-foreground">
          {url.filters.topic
            ? "General language such as “however” works for every topic, so it isn’t tagged with one. Topic language arrives as Lexora’s library grows."
            : "Lexora’s library is small for now. Try removing a filter."}
        </p>
        <Link
          href={finderHref(basePath, { q: "", filters: {}, page: 1 })}
          className="mt-4 rounded-xs type-label text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear filters
        </Link>
      </div>
    );
  }

  const first = (response.page - 1) * response.pageSize + 1;
  const last = first + response.items.length - 1;
  const pageHref = (page: number) => finderHref(basePath, { ...url, page });

  return (
    <section aria-labelledby="browse-title" className="max-w-reading space-y-4">
      <div>
        <h2
          id="browse-title"
          ref={heading}
          tabIndex={-1}
          className="type-heading text-foreground outline-none"
        >
          {response.total} {response.total === 1 ? "meaning" : "meanings"}
        </h2>
        <p className="mt-0.5 type-caption text-subtle-foreground">
          Core IELTS language first, then A–Z
          {response.pages > 1 ? ` · ${first}–${last} of ${response.total}` : null}
        </p>
      </div>
      <ul className="rounded-lg border border-border bg-card p-1">
        {response.items.map((item) => (
          <li key={item.senseId}>
            <LanguageRow
              href={languageHref(item.slug, { id: item.senseId, label: item.senseLabel })}
              term={item.headword}
              category={CATEGORY_BY_KIND[item.kind]}
              context={item.senseLabel ? `${item.senseLabel} — ${item.bestWhen}` : item.bestWhen}
            />
          </li>
        ))}
      </ul>
      {response.pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <PageLink
            href={response.page > 1 ? pageHref(response.page - 1) : undefined}
            label={`Previous page, page ${response.page - 1} of ${response.pages}`}
          >
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </PageLink>
          <p className="type-caption text-muted-foreground">
            Page {response.page} of {response.pages}
          </p>
          <PageLink
            href={response.page < response.pages ? pageHref(response.page + 1) : undefined}
            label={`Next page, page ${response.page + 1} of ${response.pages}`}
          >
            Next
            <ChevronRight aria-hidden className="size-4" />
          </PageLink>
        </nav>
      ) : null}
    </section>
  );
}

/** A page link, or a dimmed placeholder at either end so the controls don't move. */
function PageLink({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: React.ReactNode;
}) {
  const shape =
    "inline-flex h-control-md items-center gap-1.5 rounded-md border px-3 type-label max-sm:h-11";
  if (!href) {
    return (
      <span aria-hidden className={cn(shape, "border-border text-disabled-foreground")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        shape,
        "border-border bg-card text-foreground transition-colors duration-120 ease-standard outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {children}
    </Link>
  );
}
