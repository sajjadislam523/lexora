import { Lightbulb } from "lucide-react";
import Link from "next/link";

import { Callout } from "@/components/lexora/callout";
import { CategoryBadge } from "@/components/lexora/category-badge";
import { MistakeRow } from "@/components/lexora/mistake-row";
import { SkillComparison } from "@/components/lexora/skill-comparison";
import { StrengthMeter } from "@/components/lexora/strength-meter";
import { TagBadge } from "@/components/lexora/tag-badge";
import { PageContainer } from "@/components/shell/page-container";
import { PRACTICE_SESSION } from "@/demo/practice";
import type { LanguageItem } from "@/language/types";
import { cn } from "@/lib/utils";

import { ExamplesSection } from "./examples-section";
import { BackToSearch, LanguageActions } from "./language-actions";

function practiceHref(slug: string) {
  const index = PRACTICE_SESSION.findIndex((q) => q.focusSlug === slug);
  return index >= 0 ? `/practice?step=${index + 1}` : "/practice";
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t border-border pt-8">
      <h2 id={id} className="type-heading text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Glance({ item, className }: { item: LanguageItem; className?: string }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Part of speech", value: item.partOfSpeech },
    {
      label: "Register",
      value: (
        <span className="flex flex-wrap gap-1">
          {item.register.map((r) => (
            <TagBadge key={r} tag={r} />
          ))}
        </span>
      ),
    },
    { label: "Level", value: <span className="type-mono">{item.level}</span> },
    ...(item.strength
      ? [{ label: "Strength", value: <StrengthMeter strength={item.strength} /> }]
      : []),
    {
      label: "Best for",
      value: (
        <span className="flex flex-wrap gap-1">
          {item.skills.map((s) => (
            <TagBadge key={s} tag={s} />
          ))}
        </span>
      ),
    },
  ];

  return (
    <dl className={cn("grid gap-x-6 gap-y-3", className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-col gap-1">
          <dt className="type-overline text-subtle-foreground">{row.label}</dt>
          <dd className="type-body text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A language item page: teaches how to use the language, not just what it means.
 * Public and server-rendered; the only account-aware parts are the client-side actions.
 */
export function LanguageDetail({ item }: { item: LanguageItem }) {
  return (
    <PageContainer>
      <BackToSearch />

      <div className="mt-6 grid gap-x-12 gap-y-10 xl:grid-cols-3">
        <article className="min-w-0 space-y-8 xl:col-span-2">
          <header className="space-y-4">
            <CategoryBadge category={item.category} />
            <div>
              <h1 className="type-term-display text-foreground">{item.term}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {item.ipa ? (
                  <span className="type-mono text-subtle-foreground">{item.ipa}</span>
                ) : null}
                <span className="type-caption text-muted-foreground">{item.partOfSpeech}</span>
              </p>
            </div>
            <LanguageActions
              slug={item.slug}
              term={item.term}
              practiceHref={practiceHref(item.slug)}
            />
            <div className="rounded-lg border border-border bg-card p-4 xl:hidden">
              <Glance item={item} className="grid-cols-2 sm:grid-cols-3" />
            </div>
          </header>

          <Section id="meaning" title="Meaning">
            <p className="type-reading text-foreground">{item.meaning}</p>
            {item.pattern ? (
              <p className="inline-flex max-w-full rounded-xs bg-muted px-2 py-1 type-mono text-foreground">
                {item.pattern}
              </p>
            ) : null}
          </Section>

          <Section id="context" title="When it works best">
            <p className="flex gap-3 rounded-md bg-muted p-4 type-reading text-foreground">
              <Lightbulb aria-hidden className="mt-1 size-4 shrink-0 text-ink" />
              {item.bestWhen}
            </p>
            {item.avoidWhen ? (
              <Callout tone="warning" title="Don’t use it when…">
                {item.avoidWhen}
              </Callout>
            ) : null}
          </Section>

          {item.collocations && item.collocations.length > 0 ? (
            <Section id="collocations" title="Common collocations">
              <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                {item.collocations.map((c) => (
                  <li key={c.phrase} className="bg-card px-4 py-3 sm:last:odd:col-span-2">
                    <p className="type-term-sm text-foreground">{c.phrase}</p>
                    <p className="type-caption text-muted-foreground">{c.note}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="examples" title="Examples">
            <ExamplesSection examples={item.examples} />
          </Section>

          {item.usage ? (
            <Section id="skills" title="In writing and speaking">
              <SkillComparison
                writing={item.usage.writing}
                speaking={item.usage.speaking}
                note={item.usage.note}
              />
            </Section>
          ) : null}

          {item.mistakes && item.mistakes.length > 0 ? (
            <Section id="mistakes" title="Common mistakes">
              <div className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
                {item.mistakes.map((m) => (
                  <MistakeRow key={m.wrong} wrong={m.wrong} right={m.right} why={m.why} />
                ))}
              </div>
            </Section>
          ) : null}

          {item.related && item.related.length > 0 ? (
            <Section id="related" title="Related language">
              <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
                {item.related.map((r) => (
                  <li key={r.term} className="flex items-baseline gap-4 px-4 py-3">
                    <span className="w-24 shrink-0 type-caption text-subtle-foreground">
                      {r.relation}
                    </span>
                    {r.slug ? (
                      <Link
                        href={`/language/${r.slug}`}
                        className="rounded-xs type-term-sm text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {r.term}
                      </Link>
                    ) : (
                      <span className="type-term-sm text-foreground">{r.term}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-16 space-y-4 rounded-lg border border-border bg-card p-5">
            <h2 className="type-subheading text-foreground">At a glance</h2>
            <Glance item={item} className="grid-cols-1" />
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
