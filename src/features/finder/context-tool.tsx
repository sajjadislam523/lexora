"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { GapSentence } from "@/components/lexora/gap-sentence";
import { MistakeRow } from "@/components/lexora/mistake-row";
import { VERDICTS, VerdictBadge } from "@/components/lexora/verdict-badge";
import type { ResultGroup, SearchResponse, SearchResult } from "@/language/search/types";
import { cn } from "@/lib/utils";

import {
  groupHeading,
  isPair,
  sentenceFills,
  sentenceLayout,
  toolHeading,
  type SentenceLayout,
} from "./context-presentation";

/** The word(s) a result puts in the gaps: "allocate … to" for a pair, "allocate" otherwise. */
function FillLabel({ result }: { result: SearchResult }) {
  const word = result.fill?.word ?? result.term;
  const preposition = result.fill?.preposition;
  if (!preposition) return <>{word}</>;
  // A pair's two words fill the two gaps together; a verb's preposition is what it brings.
  return isPair(result) ? (
    <>
      {word}
      <span className="text-subtle-foreground"> … </span>
      {preposition}
    </>
  ) : (
    <>
      {word}
      <span className="text-muted-foreground"> … {preposition}</span>
    </>
  );
}

function fillText(result: SearchResult) {
  const word = result.fill?.word ?? result.term;
  return result.fill?.preposition ? `${word} … ${result.fill.preposition}` : word;
}

/**
 * One answer: the word(s), the verdict, the engine's reason, and a way to the language page.
 * Choosing the word puts it in the sentence above.
 */
function ContextCandidate({
  result,
  selected,
  onSelect,
}: {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const verdict = result.gapMatch?.verdict;
  return (
    <li className="flex flex-col gap-1.5 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`Try “${fillText(result)}” in the sentence`}
          onClick={onSelect}
          className={cn(
            "-mx-1.5 min-h-8 cursor-pointer rounded-sm px-1.5 text-left type-term-sm text-foreground transition-colors duration-120 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
            selected && "bg-ink-soft text-ink-strong hover:bg-ink-soft",
          )}
        >
          <FillLabel result={result} />
        </button>
        {verdict ? <VerdictBadge verdict={verdict} /> : null}
      </div>
      <p className="type-caption text-muted-foreground">{result.reason}</p>
      <Link
        href={`/language/${result.slug}`}
        className="inline-flex items-center gap-1 self-start rounded-xs type-caption text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        How to use “{result.term}”
        <ArrowRight aria-hidden className="size-3" />
      </Link>
    </li>
  );
}

function ContextGroup({
  group,
  layout,
  selectedKey,
  onSelect,
}: {
  group: ResultGroup;
  layout: SentenceLayout;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const id = useId();
  const pairs = group.results.length > 0 && group.results.every(isPair);
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="type-subheading text-foreground">
        {groupHeading(group, layout.blanks)}
      </h3>
      {pairs ? (
        <p className="type-caption text-subtle-foreground">
          Each answer fills both gaps together, as one pattern.
        </p>
      ) : null}
      <ul className="divide-y divide-border-subtle rounded-lg border border-border">
        {group.results.map((result) => (
          <ContextCandidate
            key={result.key}
            result={result}
            selected={result.key === selectedKey}
            onSelect={() => onSelect(result.key)}
          />
        ))}
      </ul>
    </section>
  );
}

/** What the five labels mean, one tap away: never a tooltip, never a score. */
function VerdictLegend() {
  return (
    <details className="group rounded-md border border-border-subtle px-3.5 py-2.5">
      <summary className="cursor-pointer rounded-xs type-label text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        What the fit labels mean
      </summary>
      <dl className="mt-3 space-y-2.5">
        {(Object.keys(VERDICTS) as (keyof typeof VERDICTS)[]).map((verdict) => (
          <div key={verdict} className="flex flex-col items-start gap-1 sm:flex-row sm:gap-3">
            <dt className="shrink-0 sm:w-28">
              <VerdictBadge verdict={verdict} />
            </dt>
            <dd className="type-caption text-muted-foreground">{VERDICTS[verdict].description}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 type-caption text-subtle-foreground">
        Labels come from the patterns in Lexora’s library. They describe how well a word fits this
        sentence’s pattern — they are not a grammar check of the whole sentence.
      </p>
    </details>
  );
}

/**
 * The signature Lexora interaction: words for the gaps in the learner's own sentence, each with
 * how well it fits and why. Exploration, not a test — choosing a word puts it in the sentence.
 * Everything shown comes from the engine's context-gap answer: groups, order, verdicts, reasons,
 * pairs and mistakes; nothing is recomputed or combined here.
 */
export function ContextTool({
  sentence,
  response,
  className,
}: {
  /** The sentence as the learner typed it, with the gaps. */
  sentence: string;
  /** The engine's context-gap response for it. */
  response: SearchResponse;
  className?: string;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const layout = sentenceLayout(sentence, response);
  const heading = toolHeading(response, layout);
  const results = response.groups.flatMap((group) => group.results);
  const selected = results.find((result) => result.key === selectedKey);
  const hasPairs = results.some(isPair);
  const firstSingle = response.groups.findIndex((group) => !group.results.every(isPair));

  return (
    <section
      aria-labelledby="context-tool-title"
      className={cn("rounded-lg border border-border bg-card p-5 sm:p-6", className)}
    >
      <p className="type-overline text-subtle-foreground">Find by context</p>
      <h2 id="context-tool-title" className="mt-1.5 type-heading text-foreground">
        {heading.title}
      </h2>
      <p className="mt-1 type-body text-muted-foreground">{heading.lead}</p>

      <div className="mt-5 rounded-md bg-muted px-4 py-4" aria-live="polite">
        <GapSentence
          parts={layout.parts}
          fills={sentenceFills(selected, layout)}
          numbered={layout.blanks > 1}
        />
      </div>
      <p className="mt-2 type-caption text-subtle-foreground">
        {selected
          ? "Choose another answer to compare it in your sentence."
          : "Choose an answer to see it in your sentence."}
      </p>

      <div className="mt-6 space-y-6">
        {response.groups.map((group, index) => (
          <div key={group.label ?? index} className="space-y-2">
            {hasPairs && index === firstSingle ? (
              <p className="type-caption text-subtle-foreground">
                The answers below are for one gap each. Lexora doesn’t combine them.
              </p>
            ) : null}
            <ContextGroup
              group={group}
              layout={layout}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </div>
        ))}

        {response.mistakes.length > 0 ? (
          <section aria-labelledby="context-mistakes-title" className="space-y-2">
            <h3 id="context-mistakes-title" className="type-subheading text-foreground">
              Mistakes to avoid
            </h3>
            <div className="divide-y divide-border-subtle rounded-lg border border-border">
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

        <VerdictLegend />
      </div>
    </section>
  );
}
