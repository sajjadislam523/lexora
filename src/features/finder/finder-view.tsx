"use client";

import { Info, SearchX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FilterChip } from "@/components/lexora/filter-chip";
import { Kbd } from "@/components/lexora/kbd";
import { PageHeader } from "@/components/lexora/page-header";
import { SearchField } from "@/components/lexora/search-field";
import { SkillComparison } from "@/components/lexora/skill-comparison";
import { SaveableResultCard } from "@/components/language/saveable-result-card";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import {
  EXAMPLE_SEARCHES,
  FEATURED_SEARCHES,
  SEARCH_MODES,
  searchHref,
  type ExampleSearch,
} from "@/language/examples";
import type { LanguageItem, SearchMode, SearchResult } from "@/language/types";

import { ContextTool } from "./context-tool";
import { FitGuide } from "./fit-guide";

function ExampleSearches({
  queries,
  onRun,
}: {
  queries: ExampleSearch[];
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

function Results({
  result,
  onRun,
}: {
  result: Extract<SearchResult, { kind: "match" }>;
  onRun: (text: string) => void;
}) {
  const items = result.items;
  const modeLabel = SEARCH_MODES.find((m) => m.id === result.mode)?.label;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="type-caption text-subtle-foreground">Understood as</p>
          <h2 className="mt-0.5 type-heading text-foreground">{result.understoodAs}</h2>
        </div>
        <p className="type-caption text-subtle-foreground">
          Matched on “{result.matchedOn}” · {modeLabel}
          {items.length > 0
            ? ` · ${items.length} ${items.length === 1 ? "result" : "results"}`
            : null}
        </p>
      </div>

      {result.contextTool ? (
        <ContextTool />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {result.guide ? (
            <aside className="xl:sticky xl:top-16 xl:col-start-3 xl:row-start-1 xl:self-start">
              <FitGuide guide={result.guide} />
            </aside>
          ) : null}
          <div className="space-y-4 xl:col-span-2 xl:row-start-1">
            <h2 className="sr-only">Results</h2>
            {items.map((item) => (
              <SaveableResultCard key={item.slug} item={item} />
            ))}
            {result.skillPair ? (
              <section
                aria-labelledby="skill-pair-title"
                className="rounded-lg border border-border bg-card p-5"
              >
                <h2 id="skill-pair-title" className="type-subheading text-foreground">
                  Writing or speaking?
                </h2>
                <SkillComparison
                  className="mt-3"
                  writing={result.skillPair.writing}
                  speaking={result.skillPair.speaking}
                  note={result.skillPair.note}
                />
              </section>
            ) : null}
          </div>
        </div>
      )}

      {result.related.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-5">
          <span className="mr-1 type-caption text-subtle-foreground">Related searches</span>
          {result.related.map((text) => (
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
      <h2 className="type-subheading text-foreground">Nothing in Lexora matches “{text}” yet</h2>
      <p className="mt-1 max-w-md type-body text-muted-foreground">
        Lexora’s library is small for now, and searches are matched by keyword. Try a word like
        “important” or “however”, or one of these:
      </p>
      <div className="mt-5 flex max-w-xl justify-center">
        <ExampleSearches queries={FEATURED_SEARCHES} onRun={onRun} />
      </div>
    </div>
  );
}

function Intro({ skillPair }: { skillPair?: LanguageItem["usage"] }) {
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
        {skillPair ? (
          <SkillComparison
            className="mt-5"
            writing={skillPair.writing}
            speaking={skillPair.speaking}
            note={skillPair.note}
          />
        ) : null}
      </section>
    </div>
  );
}

export type FinderViewProps = {
  /** Where searches live: `/finder` inside the app, `/explore` for everyone. */
  basePath: "/finder" | "/explore";
  query: string;
  /** Computed on the server by LanguageSearchService; null when there is no query. */
  result: SearchResult | null;
  /** Writing vs speaking example shown before the first search. */
  introSkillPair?: LanguageItem["usage"];
  eyebrow: string;
  title: string;
  description: string;
};

/**
 * The Language Finder, shared by the signed-in Finder and public Explore. The query lives in the
 * URL (`?q=`) and is searched on the server; this view renders the result. Saving goes through
 * the shared save flow, which shows visitors the save gate.
 */
export function FinderView({
  basePath,
  query,
  result,
  introSkillPair,
  eyebrow,
  title,
  description,
}: FinderViewProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(query);
  const [mode, setMode] = useState<SearchMode | null>(
    result?.kind === "match" ? result.mode : null,
  );

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

  const run = (value: string) => router.push(searchHref(basePath, value));
  const activeMode = SEARCH_MODES.find((m) => m.id === mode);
  const suggestions = mode ? EXAMPLE_SEARCHES.filter((q) => q.mode === mode) : FEATURED_SEARCHES;

  return (
    <PageContainer className="space-y-10">
      <div className="max-w-3xl space-y-5">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />

        <form
          role="search"
          aria-label={eyebrow}
          onSubmit={(event) => {
            event.preventDefault();
            run(text);
          }}
        >
          <SearchField
            ref={inputRef}
            size="lg"
            label="Describe what you want to say"
            placeholder={activeMode?.placeholder ?? "What are you trying to say?"}
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
                      router.push(basePath);
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
            Lexora covers a small, hand-picked set of language for now. Searches are matched by
            keyword.
          </p>
        </div>
      </div>

      <div aria-live="polite">
        {!result ? (
          <Intro skillPair={introSkillPair} />
        ) : result.kind === "match" ? (
          <Results result={result} onRun={run} />
        ) : (
          <NoMatch text={result.query} onRun={run} />
        )}
      </div>
    </PageContainer>
  );
}
