import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CategoryBadge } from "./category-badge";
import type { LanguageCategory } from "./language-category";
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
  example?: LanguageExample;
  tags?: LanguageTag[];
  /** Short usage note: register warnings, common mistakes, strength. */
  note?: string;
  /** Save affordance. Omit `onSaveToggle` to hide the button entirely. */
  saved?: boolean;
  onSaveToggle?: () => void;
  className?: string;
};

function Highlighted({ text, highlight }: LanguageExample) {
  if (!highlight) return <>{text}</>;
  const index = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-xs bg-ink-soft px-0.5 text-ink-strong">
        {text.slice(index, index + highlight.length)}
      </mark>
      {text.slice(index + highlight.length)}
    </>
  );
}

/**
 * A single Language Finder result: the term, what kind of language it is, how it is used,
 * and an example in context. Presentational — data and save behaviour come from the caller.
 */
export function LanguageResultCard({
  term,
  category,
  meaning,
  pattern,
  example,
  tags,
  note,
  saved = false,
  onSaveToggle,
  className,
}: LanguageResultCardProps) {
  return (
    <article
      data-slot="language-result-card"
      className={cn(
        "group/result rounded-lg border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow] duration-120 ease-standard hover:border-border-strong hover:shadow-sm sm:p-5",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <CategoryBadge category={category} />
          <h3 className="type-term text-foreground">{term}</h3>
        </div>
        {onSaveToggle ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={saved}
            aria-label={
              saved
                ? `Remove "${term}" from your language bank`
                : `Save "${term}" to your language bank`
            }
            onClick={onSaveToggle}
            className={cn("-mt-1 -mr-1.5", saved && "text-ink hover:text-ink")}
          >
            {saved ? <BookmarkCheck /> : <Bookmark />}
          </Button>
        ) : null}
      </header>

      <p className="mt-2 type-body text-muted-foreground">{meaning}</p>

      {pattern ? (
        <p className="mt-3 inline-flex max-w-full rounded-sm bg-muted px-2 py-1 type-mono text-foreground">
          {pattern}
        </p>
      ) : null}

      {example ? (
        <blockquote className="mt-3 border-l-2 border-border-strong pl-3 type-example text-foreground">
          <Highlighted {...example} />
        </blockquote>
      ) : null}

      {note ? <p className="mt-3 type-caption text-muted-foreground">{note}</p> : null}

      {tags && tags.length > 0 ? (
        <footer className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </footer>
      ) : null}
    </article>
  );
}
