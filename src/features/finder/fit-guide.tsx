import { Info } from "lucide-react";

import type { FitGuideData } from "@/language/types";
import { cn } from "@/lib/utils";

/** "Which one fits?" — the at-a-glance distinction between near-synonyms. */
export function FitGuide({ guide, className }: { guide: FitGuideData; className?: string }) {
  return (
    <section
      aria-labelledby="fit-guide-title"
      className={cn("rounded-lg border border-border bg-card p-5", className)}
    >
      <h2 id="fit-guide-title" className="type-subheading text-foreground">
        {guide.title}
      </h2>
      <dl className="mt-3 divide-y divide-border-subtle">
        {guide.rows.map((row) => (
          <div key={row.term} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
            <dt className="type-term-sm text-foreground">{row.term}</dt>
            <dd className="type-caption text-muted-foreground">{row.when}</dd>
          </div>
        ))}
      </dl>
      {guide.note ? (
        <p className="mt-4 flex gap-2 rounded-md bg-muted px-3 py-2.5 type-caption text-foreground">
          <Info aria-hidden className="mt-px size-3.5 shrink-0 text-ink" />
          {guide.note}
        </p>
      ) : null}
    </section>
  );
}
