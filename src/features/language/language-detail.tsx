import { Lightbulb } from "lucide-react";
import Link from "next/link";

import { CATEGORY_BY_KIND } from "@/components/language/card-props";
import { SaveLanguageButton } from "@/components/language/save-language-button";
import { Callout } from "@/components/lexora/callout";
import { CategoryBadge } from "@/components/lexora/category-badge";
import { MistakeRow } from "@/components/lexora/mistake-row";
import { StrengthMeter } from "@/components/lexora/strength-meter";
import { TagBadge } from "@/components/lexora/tag-badge";
import { PageContainer } from "@/components/shell/page-container";
import type { LanguageDetail as LanguageDetailData, RelatedSense, Sense } from "@/language/model";
import { languageHref, senseAnchor } from "@/language/links";
import { RELATION_GROUPS } from "@/language/relations";
import { cn } from "@/lib/utils";

import { ExamplesSection } from "./examples-section";
import {
  IELTS_RELEVANCE,
  IELTS_TASK,
  LINKER_CONNECTS,
  MISTAKE_TYPE,
  PART_OF_SPEECH,
  linkerPositions,
} from "./labels";
import { BackToSearch, LanguageActions } from "./language-actions";

type Level = 2 | 3;

function Section({
  id,
  title,
  level,
  children,
}: {
  id: string;
  title: string;
  level: Level;
  children: React.ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id} className="space-y-4 border-t border-border pt-8">
      <Heading
        id={id}
        className={cn("text-foreground", level === 2 ? "type-heading" : "type-subheading")}
      >
        {title}
      </Heading>
      {children}
    </section>
  );
}

function Glance({ sense, className }: { sense: Sense; className?: string }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Part of speech", value: PART_OF_SPEECH[sense.partOfSpeech] },
    {
      label: "Register",
      value: (
        <span className="flex flex-wrap gap-1">
          {sense.registers.map((register) => (
            <TagBadge key={register} tag={register} />
          ))}
        </span>
      ),
    },
    { label: "Level", value: <span className="type-mono">{sense.cefr}</span> },
    ...(sense.strength
      ? [{ label: "Strength", value: <StrengthMeter strength={sense.strength} /> }]
      : []),
    {
      label: "Best for",
      value: (
        <span className="flex flex-wrap gap-1">
          {sense.skills.map((skill) => (
            <TagBadge key={skill} tag={skill} />
          ))}
        </span>
      ),
    },
    {
      label: "IELTS",
      value: (
        <span>
          {IELTS_RELEVANCE[sense.ieltsRelevance]}
          <span className="block type-caption text-muted-foreground">
            {sense.ieltsTasks.map((task) => IELTS_TASK[task]).join(" · ")}
          </span>
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

function RelatedLanguage({ relations }: { relations: RelatedSense[] }) {
  const groups = RELATION_GROUPS.map((group) => ({
    label: group.label,
    items: relations.filter((relation) => group.types.includes(relation.type)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:gap-4">
          <p className="type-overline text-subtle-foreground sm:w-28 sm:shrink-0 sm:pt-1">
            {group.label}
          </p>
          <ul className="min-w-0 flex-1 space-y-3">
            {group.items.map((relation) => (
              <li key={`${relation.type}:${relation.senseId}`} className="space-y-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={languageHref(relation.slug, {
                      id: relation.senseId,
                      label: relation.senseLabel,
                    })}
                    className="rounded-xs py-0.5 type-term-sm wrap-break-word text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {relation.headword}
                  </Link>
                  {relation.senseLabel ? (
                    <span className="type-caption text-muted-foreground">
                      {relation.senseLabel}
                    </span>
                  ) : null}
                </p>
                {relation.note ? (
                  <p className="type-caption text-muted-foreground">{relation.note}</p>
                ) : null}
                {relation.contextNote ? (
                  <p className="type-caption text-subtle-foreground">{relation.contextNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Everything authored for one sense, in the order of docs/DESIGN.md §10.4. Empty sections are skipped. */
function SenseContent({
  sense,
  level,
  idPrefix,
}: {
  sense: Sense;
  level: Level;
  idPrefix: string;
}) {
  const id = (name: string) => `${idPrefix}${name}`;
  const hasPatterns = sense.prepositionPatterns.length > 0 || sense.frames.length > 0;

  return (
    <>
      <Section id={id("meaning")} title="Meaning" level={level}>
        <p className="type-reading text-foreground">{sense.definition}</p>
      </Section>

      <Section id={id("context")} title="When it works best" level={level}>
        <p className="flex gap-3 rounded-md bg-muted p-4 type-reading text-foreground">
          <Lightbulb aria-hidden className="mt-1 size-4 shrink-0 text-ink" />
          {sense.bestWhen}
        </p>
        {sense.avoidWhen ? (
          <Callout tone="warning" title="Don’t use it when…">
            {sense.avoidWhen}
          </Callout>
        ) : null}
      </Section>

      {sense.linker ? (
        <Section id={id("linker")} title="How it links ideas" level={level}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {[
              { label: "Links", value: LINKER_CONNECTS[sense.linker.connects] },
              { label: "Position", value: linkerPositions(sense.linker.positions) },
              { label: "Punctuation", value: sense.linker.punctuation },
            ].map((row) => (
              <div key={row.label} className="flex min-w-0 flex-col gap-1">
                <dt className="type-overline text-subtle-foreground">{row.label}</dt>
                <dd className="type-body text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {hasPatterns ? (
        <Section id={id("patterns")} title="Patterns" level={level}>
          <ul className="space-y-3">
            {sense.prepositionPatterns.map((pattern) => (
              <li key={pattern.id} className="space-y-1">
                <p className="inline-flex max-w-full rounded-xs bg-muted px-2 py-1 type-mono wrap-break-word text-foreground">
                  {pattern.pattern}
                </p>
                {pattern.note ? (
                  <p className="type-caption text-muted-foreground">{pattern.note}</p>
                ) : null}
              </li>
            ))}
            {sense.frames.map((frame) => (
              <li key={frame.id}>
                <p className="inline-flex max-w-full rounded-xs bg-muted px-2 py-1 type-mono wrap-break-word text-foreground">
                  {frame.display}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {sense.collocations.length > 0 ? (
        <Section id={id("collocations")} title="Common collocations" level={level}>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {sense.collocations.map((collocation) => (
              <li
                key={collocation.id}
                className="min-w-0 space-y-0.5 bg-card px-4 py-3 sm:last:odd:col-span-2"
              >
                <p className="type-term-sm wrap-break-word text-foreground">
                  {collocation.itemSlug ? (
                    <Link
                      href={`/language/${collocation.itemSlug}`}
                      className="rounded-xs text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {collocation.phrase}
                    </Link>
                  ) : (
                    collocation.phrase
                  )}
                </p>
                {collocation.pattern ? (
                  <p className="type-mono wrap-break-word text-muted-foreground">
                    {collocation.pattern}
                  </p>
                ) : null}
                {collocation.note ? (
                  <p className="type-caption text-muted-foreground">{collocation.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {sense.examples.length > 0 ? (
        <Section id={id("examples")} title="Examples" level={level}>
          <ExamplesSection examples={sense.examples} />
        </Section>
      ) : null}

      {sense.skillNote ? (
        <Section id={id("skills")} title="In writing and speaking" level={level}>
          <p className="type-reading text-foreground">{sense.skillNote}</p>
        </Section>
      ) : null}

      {sense.mistakes.length > 0 ? (
        <Section id={id("mistakes")} title="Common mistakes" level={level}>
          <div className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
            {sense.mistakes.map((mistake) => (
              <MistakeRow
                key={mistake.id}
                type={MISTAKE_TYPE[mistake.type]}
                wrong={mistake.wrong}
                right={mistake.right}
                why={mistake.explanation}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {sense.relations.length > 0 ? (
        <Section id={id("related")} title="Related language" level={level}>
          <RelatedLanguage relations={sense.relations} />
        </Section>
      ) : null}
    </>
  );
}

/** Spelling variants ("analyze, US spelling") and the authored regional note. */
function Variants({ item }: { item: LanguageDetailData }) {
  const variants = item.forms.filter((form) => form.type === "spelling_variant");
  if (variants.length === 0 && !item.regionalNote) return null;
  return (
    <div className="space-y-1">
      {variants.length > 0 ? (
        <p className="type-body text-foreground">
          <span className="text-muted-foreground">Also spelled </span>
          {variants.map((variant, index) => (
            <span key={variant.form}>
              {index > 0 ? ", " : null}
              <span className="type-term-sm">{variant.form}</span>
              {variant.region ? (
                <span className="type-caption text-muted-foreground">
                  {" "}
                  ({variant.region === "us" ? "US" : "British"})
                </span>
              ) : null}
            </span>
          ))}
        </p>
      ) : null}
      {item.regionalNote ? (
        <p className="type-caption text-muted-foreground">{item.regionalNote}</p>
      ) : null}
    </div>
  );
}

/**
 * A language item page, rendered from the published content in PostgreSQL. It teaches how to
 * use the language, not just what it means, and keeps each meaning's alternatives, patterns,
 * examples and mistakes with that meaning. Public and server-rendered; the only account-aware
 * parts are the client-side actions.
 */
export function LanguageDetail({ item }: { item: LanguageDetailData }) {
  const single = item.senses.length === 1;
  const first = item.senses[0]!;
  const partsOfSpeech = [
    ...new Set(item.senses.map((sense) => PART_OF_SPEECH[sense.partOfSpeech])),
  ];

  return (
    <PageContainer>
      <BackToSearch />

      <div className="mt-6 grid gap-x-12 gap-y-10 xl:grid-cols-3">
        <article className="min-w-0 space-y-8 xl:col-span-2">
          <header className="space-y-4">
            <CategoryBadge category={CATEGORY_BY_KIND[item.kind]} />
            <div>
              <h1 className="type-term-display wrap-break-word text-foreground">{item.headword}</h1>
              <p className="mt-2 type-caption text-muted-foreground">
                {partsOfSpeech.join(" · ")}
                {single ? null : ` · ${item.senses.length} meanings`}
              </p>
            </div>
            <Variants item={item} />
            <LanguageActions
              target={single ? { senseId: first.id, label: item.headword } : undefined}
            />
            {single ? (
              <div className="rounded-lg border border-border bg-card p-4 xl:hidden">
                <Glance sense={first} className="grid-cols-2 sm:grid-cols-3" />
              </div>
            ) : (
              <nav aria-label="Meanings" className="xl:hidden">
                <MeaningsList item={item} />
              </nav>
            )}
          </header>

          {single ? (
            <SenseContent sense={first} level={2} idPrefix="" />
          ) : (
            item.senses.map((sense, index) => {
              const anchor = senseAnchor(sense.id);
              return (
                <section
                  key={sense.id}
                  id={anchor}
                  aria-labelledby={`${anchor}-title`}
                  className="scroll-mt-20 space-y-8 rounded-lg border border-border p-4 sm:p-6"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 id={`${anchor}-title`} className="type-heading text-foreground">
                        <span className="text-muted-foreground">Meaning {index + 1}</span>
                        {sense.label ? ` · ${sense.label}` : null}
                      </h2>
                      <SaveLanguageButton
                        size="sm"
                        text={{ save: "Save this meaning", saved: "Saved" }}
                        target={{
                          senseId: sense.id,
                          label: `${item.headword} — ${sense.label ?? `meaning ${index + 1}`}`,
                        }}
                      />
                    </div>
                    <div className="rounded-md border border-border bg-card p-4">
                      <Glance sense={sense} className="grid-cols-2 sm:grid-cols-3" />
                    </div>
                  </div>
                  <SenseContent sense={sense} level={3} idPrefix={`${anchor}-`} />
                </section>
              );
            })
          )}

          <footer className="border-t border-border pt-6 type-caption text-subtle-foreground">
            Source: {item.source.name}
            {item.source.attribution ? ` — ${item.source.attribution}` : null}
          </footer>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-16 space-y-4 rounded-lg border border-border bg-card p-5">
            {single ? (
              <>
                <h2 className="type-subheading text-foreground">At a glance</h2>
                <Glance sense={first} className="grid-cols-1" />
              </>
            ) : (
              <nav aria-label="Meanings">
                <MeaningsList item={item} />
              </nav>
            )}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function MeaningsList({ item }: { item: LanguageDetailData }) {
  return (
    <div className="space-y-2">
      <h2 className="type-subheading text-foreground">Meanings</h2>
      <ol className="space-y-1">
        {item.senses.map((sense, index) => (
          <li key={sense.id}>
            <a
              href={`#${senseAnchor(sense.id)}`}
              className="flex gap-2 rounded-sm px-1 py-1 type-body text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="type-mono text-subtle-foreground">{index + 1}</span>
              <span>{sense.label ?? sense.definition}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
