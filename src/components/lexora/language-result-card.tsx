import { Bookmark, BookmarkCheck, CornerDownRight, Lightbulb } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CategoryBadge } from "./category-badge";
import { HighlightedText } from "./highlighted-text";
import type { LanguageCategory } from "./language-category";
import { StrengthMeter } from "./strength-meter";
import { TagBadge, type LanguageTag } from "./tag-badge";

export type LanguageExample = {
  text: string;
  /** Substring of `text` to emphasise — usually the term itself. */
  highlight?: string;
};

export type LanguageResultCardProps = {
  term: string;
  category: LanguageCategory;
  /** One-line meaning or use, in plain English. */
  meaning: string;
  /** Structural pattern, e.g. "responsible for + noun / -ing". */
  pattern?: string;
  /** Common combinations, e.g. "significant increase". */
  collocations?: string[];
  example?: LanguageExample;
  /** "Best when …" — the context in which this choice works. */
  bestWhen?: string;
  tags?: LanguageTag[];
  /** Strength relative to the plain alternative (1–3). */
  strength?: 1 | 2 | 3;
  /** Short usage note: register warnings, common mistakes. */
  note?: string;
  /** Why this result appeared, as the search engine explains it. Shown under the term. */
  reason?: string;
  /** Sense label when the term has several meanings ("having a real effect"). */
  senseLabel?: string;
  /** Makes the whole card selectable, leading to the item's detail page. */
  href?: string;
  /** Save affordance. Omit `onSaveToggle` to hide the button entirely. */
  saved?: boolean;
  /** What the save button saves, when it isn't the term ("significant — having a real effect"). */
  saveLabel?: string;
  /** Saved state is loading or a change is on its way. */
  saveBusy?: boolean;
  onSaveToggle?: () => void;
  className?: string;
};

/**
 * A single Language Finder result: the term, what kind of language it is, when it fits, how it
 * combines, and an example in context. Presentational — data and save behaviour come from the
 * caller. With `href`, the card is one large link; the save button stays separately focusable.
 */
export function LanguageResultCard({
  term,
  category,
  meaning,
  pattern,
  collocations,
  example,
  bestWhen,
  tags,
  strength,
  note,
  reason,
  senseLabel,
  href,
  saved = false,
  saveLabel,
  saveBusy = false,
  onSaveToggle,
  className,
}: LanguageResultCardProps) {
  return (
    <article
      data-slot="language-result-card"
      className={cn(
        "group/result relative rounded-lg border border-border bg-card p-4 transition-[border-color,box-shadow] duration-120 ease-standard hover:border-border-strong hover:shadow-sm sm:p-5",
        href &&
          "has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-ring",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <CategoryBadge category={category} />
          <h3 className="type-term text-foreground">
            {href ? (
              <Link
                href={href}
                data-card-link
                className="outline-none after:absolute after:inset-0 after:rounded-lg"
              >
                {term}
              </Link>
            ) : (
              term
            )}
            {senseLabel ? (
              <span className="ml-2 align-middle type-caption text-muted-foreground">
                {senseLabel}
              </span>
            ) : null}
          </h3>
          {reason ? (
            <p className="flex gap-1.5 type-caption text-muted-foreground">
              <CornerDownRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink" />
              <span>
                <span className="sr-only">Why it’s here: </span>
                {reason}
              </span>
            </p>
          ) : null}
        </div>
        {onSaveToggle ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={saved}
            aria-busy={saveBusy}
            aria-label={
              saved
                ? `Saved — remove “${saveLabel ?? term}” from your language bank`
                : `Save “${saveLabel ?? term}” to your language bank`
            }
            onClick={onSaveToggle}
            className={cn("relative z-10 -mt-1 -mr-1.5", saved && "text-ink hover:text-ink")}
          >
            {saved ? <BookmarkCheck /> : <Bookmark />}
          </Button>
        ) : null}
      </header>

      <p className="mt-2 type-body text-muted-foreground">{meaning}</p>

      {bestWhen ? (
        <p className="mt-3 flex gap-2 type-body text-foreground">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
          <span>
            <span className="font-medium">Best when </span>
            {bestWhen.charAt(0).toLowerCase() + bestWhen.slice(1)}
          </span>
        </p>
      ) : null}

      {pattern ? (
        <p className="mt-3 inline-flex max-w-full rounded-xs bg-muted px-2 py-1 type-mono text-foreground">
          {pattern}
        </p>
      ) : null}

      {collocations && collocations.length > 0 ? (
        <div className="mt-3">
          <p className="sr-only">Common combinations</p>
          <ul className="flex flex-wrap gap-1.5">
            {collocations.map((phrase) => (
              <li
                key={phrase}
                className="rounded-xs border border-border-subtle bg-background px-1.5 py-0.5 type-caption text-foreground"
              >
                {phrase}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {example ? (
        <blockquote className="mt-4 border-l-2 border-border-strong pl-3.5 type-example text-foreground">
          <HighlightedText text={example.text} highlight={example.highlight} />
        </blockquote>
      ) : null}

      {note ? <p className="mt-3 type-caption text-muted-foreground">{note}</p> : null}

      {(tags && tags.length > 0) || strength ? (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            {tags?.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
          {strength ? <StrengthMeter strength={strength} /> : null}
        </footer>
      ) : null}
    </article>
  );
}
