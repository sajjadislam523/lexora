"use client";

import { Info, SearchX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Callout } from "@/components/lexora/callout";
import { FilterChip } from "@/components/lexora/filter-chip";
import { Kbd } from "@/components/lexora/kbd";
import { MistakeRow } from "@/components/lexora/mistake-row";
import { PageHeader } from "@/components/lexora/page-header";
import { SearchField } from "@/components/lexora/search-field";
import { SkillComparison } from "@/components/lexora/skill-comparison";
import { SaveableResultCard } from "@/components/language/saveable-result-card";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EXAMPLE_SEARCHES,
  FEATURED_SEARCHES,
  SEARCH_MODES,
  modeForResponse,
  searchHref,
  type ExampleSearch,
  type SearchMode,
} from "@/language/examples";
import type { SearchResponse } from "@/language/search/types";
import type { DiscoveryShowcase } from "@/language/showcase";

import { ContextTool } from "./context-tool";
import { FitGuide } from "./fit-guide";

function ExampleSearches({
  queries,
  onRun,
  label = "Try",
}: {
  queries: ExampleSearch[];
  onRun: (text: string) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 type-caption text-subtle-foreground">{label}</span>
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

/** How the engine read the typed term, when it isn't simply what was typed. */
function TermNotice({ response }: { response: SearchResponse }) {
  const term = response.interpretation.term;
  if (term?.via === "typo") {
    return (
      <Callout tone="info" title={`Showing results for “${term.resolved}”`}>
        You typed “{term.input}”. Lexora corrects a spelling only when one word is clearly closest.
      </Callout>
    );
  }
  if (term?.via === "variant" && term.note) {
    return (
      <Callout tone="info" title="Spelling variant">
        {term.note}
      </Callout>
    );
  }
  if (response.outcome === "fallback") {
    return (
      <Callout tone="info" title="No exact match">
        These items mention your words in their meaning or examples. Try a single word, or describe
        what you want to do, for closer results.
      </Callout>
    );
  }
  return null;
}

function Results({ response, onRun }: { response: SearchResponse; onRun: (text: string) => void }) {
  const count = response.groups.reduce((total, group) => total + group.results.length, 0);
  const mode = modeForResponse(response);
  const modeLabel = SEARCH_MODES.find((m) => m.id === mode)?.label;
  const isGap = response.interpretation.intent === "CONTEXT_GAP";

  return (
    <div className="space-y-8">
      <div className="space-y-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="type-caption text-subtle-foreground">Understood as</p>
            <h2 className="mt-0.5 type-heading text-foreground">
              {response.interpretation.summary}
            </h2>
          </div>
          <p className="type-caption text-subtle-foreground">
            {[modeLabel, `${count} ${count === 1 ? "result" : "results"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <TermNotice response={response} />
      </div>

      {isGap ? (
        <ContextTool sentence={response.query} response={response} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {response.guide ? (
            <aside className="xl:sticky xl:top-16 xl:col-start-3 xl:row-start-1 xl:self-start">
              <FitGuide guide={response.guide} />
            </aside>
          ) : null}
          <div className="space-y-8 xl:col-span-2 xl:row-start-1">
            <h2 className="sr-only">Results</h2>
            {response.groups.map((group, index) => (
              <section key={group.label ?? index} aria-label={group.label} className="space-y-4">
                {group.label ? (
                  <h3 className="type-subheading text-foreground">{group.label}</h3>
                ) : null}
                {group.results.map((result) => (
                  <SaveableResultCard key={result.key} result={result} />
                ))}
              </section>
            ))}
            {response.mistakes.length > 0 ? (
              <section aria-labelledby="mistakes-title" className="space-y-3">
                <h3 id="mistakes-title" className="type-subheading text-foreground">
                  Common mistakes
                </h3>
                <div className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
                  {response.mistakes.map((mistake) => (
                    <MistakeRow
                      key={mistake.wrong}
                      wrong={mistake.wrong}
                      right={mistake.right}
                      why={mistake.explanation}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <ExampleSearches label="More searches" queries={FEATURED_SEARCHES} onRun={onRun} />
      </div>
    </div>
  );
}

function DidYouMean({
  response,
  onRun,
}: {
  response: SearchResponse;
  onRun: (text: string) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      <h2 className="type-subheading text-foreground">{response.interpretation.summary}</h2>
      <p className="mt-1 type-body text-muted-foreground">
        “{response.query}” is close to more than one word, so Lexora won’t guess.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {response.didYouMean!.map((option) => (
          <Button key={option} variant="outline" size="sm" onClick={() => onRun(option)}>
            {option}
          </Button>
        ))}
      </div>
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
        Lexora’s library is small for now. Try a single word like “important” or “however”, describe
        what you want to do (“I want to express contrast”), or one of these:
      </p>
      <div className="mt-5 flex max-w-xl justify-center">
        <ExampleSearches queries={FEATURED_SEARCHES} onRun={onRun} />
      </div>
    </div>
  );
}

function SearchError({ onRetry }: { onRetry: () => void }) {
  return (
    <Callout tone="danger" title="Search isn’t available right now" role="alert">
      <p>Something went wrong on our side, not with your search. Please try again in a moment.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </Callout>
  );
}

/** Mirrors the results layout while a search is on its way. No spinner, no motion. */
function ResultsSkeleton() {
  return (
    <div role="status" className="space-y-8">
      <span className="sr-only">Searching…</span>
      <div className="space-y-2 border-b border-border pb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-72 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {[0, 1].map((key) => (
            <div key={key} className="space-y-3 rounded-lg border border-border bg-card p-5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Intro({ showcase }: { showcase: DiscoveryShowcase }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {showcase.context ? (
        <ContextTool sentence={showcase.context.sentence} response={showcase.context.response} />
      ) : null}
      {showcase.skillPair ? (
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
          <SkillComparison
            className="mt-5"
            writing={showcase.skillPair.writing}
            speaking={showcase.skillPair.speaking}
            note={showcase.skillPair.note}
          />
        </section>
      ) : null}
    </div>
  );
}

/** What the server found for the URL's query. */
export type FinderState =
  | { kind: "intro"; showcase: DiscoveryShowcase }
  | { kind: "results"; response: SearchResponse }
  | { kind: "error" };

export type FinderViewProps = {
  /** Where searches live: `/finder` inside the app, `/explore` for everyone. */
  basePath: "/finder" | "/explore";
  query: string;
  state: FinderState;
  eyebrow: string;
  title: string;
  description: string;
};

function announcement(state: FinderState) {
  if (state.kind === "error") return "Search isn’t available right now.";
  if (state.kind === "intro") return "";
  const { response } = state;
  const count = response.groups.reduce((total, group) => total + group.results.length, 0);
  if (response.didYouMean) return response.interpretation.summary;
  if (count === 0) return `Nothing matches “${response.query}” yet.`;
  return `${response.interpretation.summary}: ${count} ${count === 1 ? "result" : "results"}.`;
}

/**
 * The Language Finder, shared by the signed-in Finder and public Explore. The query lives in the
 * URL (`?q=`) and is searched on the server by the language engine; this view only renders the
 * response. Saving goes through the shared save flow, which shows visitors the save gate.
 */
export function FinderView({
  basePath,
  query,
  state,
  eyebrow,
  title,
  description,
}: FinderViewProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(query);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<SearchMode | null>(
    state.kind === "results" ? modeForResponse(state.response) : null,
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

  const run = (value: string) => {
    setText(value);
    startTransition(() => router.push(searchHref(basePath, value)));
  };
  const clear = () => {
    setText("");
    startTransition(() => router.push(basePath));
    inputRef.current?.focus();
  };
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
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              if (text) {
                event.preventDefault();
                setText("");
              } else {
                inputRef.current?.blur();
              }
            }}
            hint={
              <>
                {text ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear search"
                    onClick={clear}
                  >
                    <X />
                  </Button>
                ) : (
                  <Kbd className="max-sm:hidden">/</Kbd>
                )}
                <Button type="submit" size="sm" className="ml-1" aria-disabled={pending}>
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
            Lexora covers a small, reviewed set of language for now. Every result says why it
            appears.
          </p>
        </div>
      </div>

      <p role="status" className="sr-only">
        {pending ? "" : announcement(state)}
      </p>

      <div aria-busy={pending}>
        {pending ? (
          <ResultsSkeleton />
        ) : state.kind === "error" ? (
          <SearchError onRetry={() => startTransition(() => router.refresh())} />
        ) : state.kind === "intro" ? (
          <Intro showcase={state.showcase} />
        ) : state.response.didYouMean ? (
          <DidYouMean response={state.response} onRun={run} />
        ) : state.response.outcome === "none" ? (
          <NoMatch text={state.response.query} onRun={run} />
        ) : (
          <Results response={state.response} onRun={run} />
        )}
      </div>
    </PageContainer>
  );
}
