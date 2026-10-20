"use client";

import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { FILTER_LABEL, filterValueLabel } from "@/language/filter-labels";
import {
  FILTER_DIMENSIONS,
  FILTER_VALUES,
  filterUrlValue,
  finderHref,
  parseFinderParams,
  type FilterDimension,
  type FinderState,
  type SearchFilters,
} from "@/language/filters";
import type { FilterCounts } from "@/language/search/repository";
import { cn } from "@/lib/utils";

type BasePath = "/finder" | "/explore";

/** The state with one dimension changed (or removed), back on the first page. */
function withFilter(url: FinderState, dimension: FilterDimension, value: string | undefined) {
  const parsed = value ? parseFinderParams({ [dimension]: value }).filters[dimension] : undefined;
  return { ...url, filters: { ...url.filters, [dimension]: parsed }, page: 1 };
}

const activeDimensions = (filters: SearchFilters) =>
  FILTER_DIMENSIONS.filter((dimension) => filters[dimension] !== undefined);

/**
 * "Show only": one dropdown per filter dimension (Phase 4 §5, §13). Choosing a value navigates
 * to its URL straight away; "Any" removes that filter. With counts (browsing and the start page),
 * each option shows how many senses it would match, and options that would match nothing are
 * disabled. Below `sm` the row sits behind a "Filters" disclosure. Without JavaScript the form
 * submits as a plain GET and the page redirects to the canonical URL.
 */
export function FilterBar({
  basePath,
  url,
  counts,
  onNavigate,
}: {
  basePath: BasePath;
  url: FinderState;
  counts?: FilterCounts;
  onNavigate: (href: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const active = activeDimensions(url.filters).length;

  return (
    <form
      method="get"
      action={basePath}
      role="group"
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        onNavigate(finderHref(basePath, url));
      }}
      onKeyDown={(event) => {
        // Escape closes the mobile disclosure and returns to its button.
        if (event.key !== "Escape" || !open || !toggle.current?.offsetParent) return;
        event.preventDefault();
        setOpen(false);
        toggle.current.focus();
      }}
      className="@container space-y-2"
    >
      {url.q ? <input type="hidden" name="q" value={url.q} /> : null}
      <p id={`${id}-title`} className="type-caption text-subtle-foreground max-sm:sr-only">
        Show only
      </p>
      <Button
        ref={toggle}
        type="button"
        variant="outline"
        className="w-full justify-between sm:hidden"
        aria-expanded={open}
        aria-controls={`${id}-filters`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal aria-hidden />
          Filters
        </span>
        {active > 0 ? <span className="type-caption">{active} on</span> : null}
      </Button>
      <div
        id={`${id}-filters`}
        className={cn("grid gap-3 @sm:grid-cols-2 @3xl:grid-cols-4", !open && "max-sm:hidden")}
      >
        {FILTER_DIMENSIONS.map((dimension) => {
          const selected = url.filters[dimension];
          const selectId = `${id}-${dimension}`;
          return (
            <div key={dimension} className="min-w-0 space-y-1">
              <label htmlFor={selectId} className="type-label text-muted-foreground">
                {FILTER_LABEL[dimension]}
              </label>
              <NativeSelect
                id={selectId}
                name={dimension}
                value={selected ? filterUrlValue(selected) : ""}
                onChange={(event) =>
                  onNavigate(finderHref(basePath, withFilter(url, dimension, event.target.value)))
                }
              >
                <option value="">Any</option>
                {FILTER_VALUES[dimension].map((value) => {
                  const n = counts ? (counts[dimension][value] ?? 0) : undefined;
                  return (
                    <option
                      key={value}
                      value={filterUrlValue(value)}
                      disabled={n === 0 && value !== selected}
                    >
                      {filterValueLabel(dimension, value)}
                      {n !== undefined ? ` (${n})` : ""}
                    </option>
                  );
                })}
              </NativeSelect>
            </div>
          );
        })}
      </div>
      <noscript>
        <Button type="submit" variant="outline" size="sm">
          Apply filters
        </Button>
      </noscript>
    </form>
  );
}

/**
 * The active filters in one line: "Showing only Linker, Writing Task 2 · 3 of 6 results · Clear
 * filters". Each value is a link that removes it; "Clear filters" removes them all.
 */
export function FilterCaption({
  basePath,
  url,
  summary,
}: {
  basePath: BasePath;
  url: FinderState;
  /** The result state after the filters, e.g. "3 of 6 results". */
  summary?: string;
}) {
  const active = activeDimensions(url.filters);
  if (active.length === 0) return null;
  const link =
    "rounded-xs text-foreground underline decoration-border-strong underline-offset-2 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <p className="type-caption text-muted-foreground">
      Showing only{" "}
      {active.map((dimension, index) => {
        const label = filterValueLabel(dimension, url.filters[dimension]!);
        return (
          <span key={dimension}>
            {index > 0 ? ", " : null}
            <Link
              href={finderHref(basePath, withFilter(url, dimension, undefined))}
              scroll={false}
              aria-label={`Remove the ${FILTER_LABEL[dimension].toLowerCase()} filter: ${label}`}
              className={link}
            >
              {label}
            </Link>
          </span>
        );
      })}
      {summary ? ` · ${summary}` : null} ·{" "}
      <Link
        href={finderHref(basePath, { q: url.q, filters: {}, page: 1 })}
        scroll={false}
        className={link}
      >
        Clear filters
      </Link>
    </p>
  );
}
