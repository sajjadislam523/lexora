"use client";

import { Info, SearchX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FilterChip } from "@/components/lexora/filter-chip";
import { Kbd } from "@/components/lexora/kbd";
import { LanguageResultCard } from "@/components/lexora/language-result-card";
import { PageHeader } from "@/components/lexora/page-header";
import { SearchField } from "@/components/lexora/search-field";
import { SkillComparison } from "@/components/lexora/skill-comparison";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import {
  DEMO_QUERIES,
  FEATURED_QUERY_IDS,
  SEARCH_MODES,
  getDemoQuery,
  matchDemoQuery,
  type DemoQuery,
  type SearchMode,
} from "@/demo/finder";
import { getLanguageItem, requireLanguageItem } from "@/demo/language";
import { useSavedItems } from "@/demo/saved-items";
import { toCardProps } from "@/demo/card-props";

import { ContextTool } from "./context-tool";
import { FitGuide } from "./fit-guide";

function finderHref(text: string) {
  return text.trim() ? `/finder?q=${encodeURIComponent(text.trim())}` : "/finder";
}

function ExampleSearches({
  queries,
  onRun,
}: {
  queries: DemoQuery[];
  onRun: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 type-caption text-subtle-foreground">Try</span>
      {queries.map((query) => (
        <button
          key={query.id}
          type="button"
          onClick={() => onRun(query.text)}
          className="cursor-pointer rounded-full bg-muted px-2.5 py-1 type-caption text-muted-foreground transition-colors duration-120 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {query.text}
        </button>
      ))}
    </div>
  );
}

function Results({ query, onRun }: { query: DemoQuery; onRun: (text: string) => void }) {
  const { isSaved, toggle } = useSavedItems();
  const items = query.results.map(requireLanguageItem);
  const skillItem = query.skillPairFrom ? getLanguageItem(query.skillPairFrom) : undefined;
  const modeLabel = SEARCH_MODES.find((m) => m.id === query.mode)?.label;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="type-caption text-subtle-foreground">Understood as</p>
          <h2 className="mt-0.5 type-heading text-foreground">{query.understoodAs}</h2>
        </div>
        <p className="type-caption text-subtle-foreground">
          {modeLabel} search
          {items.length > 0
            ? ` · ${items.length} ${items.length === 1 ? "result" : "results"}`
            : null}
        </p>
      </div>

      {query.mode === "context" ? (
        <ContextTool />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {query.guide ? (
            <aside className="xl:sticky xl:top-16 xl:col-start-3 xl:row-start-1 xl:self-start">
              <FitGuide guide={query.guide} />
            </aside>
          ) : null}
          <div className="space-y-4 xl:col-span-2 xl:row-start-1">
            <h2 className="sr-only">Results</h2>
            {items.map((item) => (
              <LanguageResultCard
                key={item.slug}
                {...toCardProps(item)}
                saved={isSaved(item.slug)}
                onSaveToggle={() => toggle(item.slug)}
              />
            ))}
            {skillItem?.usage ? (
              <section
                aria-labelledby="skill-pair-title"
                className="rounded-lg border border-border bg-card p-5"
              >
                <h2 id="skill-pair-title" className="type-subheading text-foreground">
                  Writing or speaking?
                </h2>
                <SkillComparison
                  className="mt-3"
                  writing={skillItem.usage.writing}
                  speaking={skillItem.usage.speaking}
                  note={skillItem.usage.note}
                />
              </section>
            ) : null}
          </div>
        </div>
      )}

      {query.related && query.related.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-5">
          <span className="mr-1 type-caption text-subtle-foreground">Related searches</span>
          {query.related.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onRun(text)}
              className="cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 type-caption text-muted-foreground transition-colors duration-120 outline-none hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoMatch({ text, onRun }: { text: string; onRun: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
      <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-4.5" />
      </span>
      <h2 className="type-subheading text-foreground">No example matches “{text}”</h2>
      <p className="mt-1 max-w-md type-body text-muted-foreground">
        This prototype only recognises a handful of example searches — it doesn&apos;t search yet.
        Real search arrives in Phase 4.
      </p>
      <div className="mt-5 flex max-w-xl justify-center">
        <ExampleSearches
          queries={FEATURED_QUERY_IDS.map((id) => getDemoQuery(id)!).filter(Boolean)}
          onRun={onRun}
        />
      </div>
    </div>
  );
}

function Intro() {
  const furthermore = requireLanguageItem("furthermore");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ContextTool />
      <section
        aria-labelledby="intro-skill-title"
        className="rounded-lg border border-border bg-card p-5 sm:p-6"
      >
        <p className="type-overline text-subtle-foreground">Writing or speaking?</p>
        <h2 id="intro-skill-title" className="mt-1.5 type-heading text-foreground">
          The same idea, two registers
        </h2>
        <p className="mt-1 type-body text-muted-foreground">
          What works in a Task 2 essay can sound stiff in Speaking Part 3.
        </p>
        {furthermore.usage ? (
          <SkillComparison
            className="mt-5"
            writing={furthermore.usage.writing}
            speaking={furthermore.usage.speaking}
            note={furthermore.usage.note}
          />
        ) : null}
      </section>
    </div>
  );
}

/**
 * The Language Finder prototype. The query lives in the URL (`?q=`). Typed queries are matched to
 * a fixed set of example searches by keyword; anything else gets an honest "no example" state.
 */
export function FinderView({ query }: { query: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const match = query ? matchDemoQuery(query) : undefined;
  const [text, setText] = useState(query);
  const [mode, setMode] = useState<SearchMode | null>(match?.mode ?? null);

  // "/" focuses the search field from anywhere on the page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = target.closest("input, textarea, [contenteditable=true]");
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (value: string) => router.push(finderHref(value));
  const activeMode = SEARCH_MODES.find((m) => m.id === mode);
  const suggestions = mode
    ? DEMO_QUERIES.filter((q) => q.mode === mode)
    : FEATURED_QUERY_IDS.map((id) => getDemoQuery(id)!).filter(Boolean);

  return (
    <PageContainer className="space-y-10">
      <div className="max-w-3xl space-y-5">
        <PageHeader
          eyebrow="Language Finder"
          title="What do you want to say?"
          description="Describe the idea in your own words. Lexora finds the natural English for it — with context, patterns and examples."
        />

        <form
          role="search"
          aria-label="Language Finder"
          onSubmit={(event) => {
            event.preventDefault();
            run(text);
          }}
        >
          <SearchField
            ref={inputRef}
            size="lg"
            label="Describe what you want to say"
            placeholder={
              activeMode?.placeholder ?? "I want to say something increased significantly"
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
            hint={
              <>
                {text ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear search"
                    onClick={() => {
                      setText("");
                      router.push("/finder");
                      inputRef.current?.focus();
                    }}
                  >
                    <X />
                  </Button>
                ) : (
                  <Kbd className="max-sm:hidden">/</Kbd>
                )}
                <Button type="submit" size="sm" className="ml-1">
                  Find
                </Button>
              </>
            }
          />
        </form>

        <div className="space-y-3">
          <div
            role="group"
            aria-label="Search as"
            className="no-scrollbar flex items-center gap-1.5 max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 sm:flex-wrap"
          >
            <span className="mr-1 shrink-0 type-caption text-subtle-foreground">Search as</span>
            {SEARCH_MODES.map((m) => (
              <FilterChip
                key={m.id}
                pressed={mode === m.id}
                onClick={() => setMode(mode === m.id ? null : m.id)}
              >
                {m.label}
              </FilterChip>
            ))}
          </div>
          <ExampleSearches queries={suggestions} onRun={run} />
          <p className="flex items-center gap-1.5 type-caption text-subtle-foreground">
            <Info aria-hidden className="size-3.5 shrink-0" />
            Prototype — results come from the example searches. Real search arrives in Phase 4.
          </p>
        </div>
      </div>

      <div aria-live="polite">
        {!query ? (
          <Intro />
        ) : match ? (
          <Results query={match} onRun={run} />
        ) : (
          <NoMatch text={query} onRun={run} />
        )}
      </div>
    </PageContainer>
  );
}
