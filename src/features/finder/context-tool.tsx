"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ChoiceOption } from "@/components/lexora/choice-option";
import { FitBadge } from "@/components/lexora/fit-badge";
import { GapSentence, type GapPart } from "@/components/lexora/gap-sentence";
import type { SearchResponse, SearchResult } from "@/language/search/types";
import { cn } from "@/lib/utils";

const GAP_MARKER = /_{2,}|…|\.{3,}/;

/**
 * Splits the learner's sentence around the gap, and around the preposition the engine read after
 * it, so each choice can fill both: "Governments should [allocate] more money [to] …".
 * Display only — which verbs fit, and why, comes from the search engine.
 */
function sentenceParts(sentence: string, preposition: string | undefined): GapPart[] {
  const match = GAP_MARKER.exec(sentence);
  if (!match) return [sentence];
  const before = sentence.slice(0, match.index);
  const after = sentence.slice(match.index + match[0].length);
  const word = preposition ? new RegExp(`\\b${preposition}\\b`, "i").exec(after) : null;
  if (!word) return [before, { gap: 0 }, after];
  return [
    before,
    { gap: 0 },
    after.slice(0, word.index),
    { gap: 1 },
    after.slice(word.index + word[0].length),
  ];
}

/**
 * The signature Lexora interaction: choose a word for a real sentence and see whether it fits,
 * including the preposition it brings with it. Exploration, not a test — every option explains
 * itself with the engine's reason.
 */
export function ContextTool({
  sentence,
  response,
  className,
}: {
  /** The sentence as the learner typed it, with the gap. */
  sentence: string;
  /** The engine's context-gap response for it. */
  response: SearchResponse;
  className?: string;
}) {
  const options: SearchResult[] = response.groups.flatMap((group) => group.results);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = options.find((option) => option.key === selectedKey);
  const parts = sentenceParts(sentence, response.gap?.preposition);
  const fills = selected ? [selected.fill?.word, selected.fill?.preposition] : undefined;

  return (
    <section
      aria-labelledby="context-tool-title"
      className={cn("rounded-lg border border-border bg-card p-5 sm:p-6", className)}
    >
      <p className="type-overline text-subtle-foreground">Find by context</p>
      <h2 id="context-tool-title" className="mt-1.5 type-heading text-foreground">
        Which verb fits this sentence?
      </h2>
      <p className="mt-1 type-body text-muted-foreground">
        Each choice changes the meaning — and brings its own preposition.
      </p>

      <div className="mt-5 rounded-md bg-muted px-4 py-4" aria-live="polite">
        <GapSentence parts={parts} fills={fills} />
      </div>

      <div role="group" aria-label="Choose a verb" className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = option.key === selectedKey;
          return (
            <ChoiceOption
              key={option.key}
              pressed={isSelected}
              state={isSelected ? "selected" : "idle"}
              language
              onClick={() => setSelectedKey(option.key)}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {option.fill?.word ?? option.term}
                  {option.fill?.preposition ? (
                    <span className="text-muted-foreground"> … {option.fill.preposition}</span>
                  ) : null}
                </span>
                {selectedKey && option.fit ? <FitBadge fit={option.fit} /> : null}
              </span>
            </ChoiceOption>
          );
        })}
      </div>

      <div className="mt-4 min-h-16 border-t border-border-subtle pt-4">
        {selected ? (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-2">
              <span className="type-term-sm text-foreground">
                {selected.pattern ?? selected.term}
              </span>
              {selected.fit ? <FitBadge fit={selected.fit} /> : null}
            </p>
            <p className="type-body text-muted-foreground">{selected.reason}</p>
            <Link
              href={`/language/${selected.slug}`}
              className="inline-flex items-center gap-1 rounded-xs type-label text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              How to use “{selected.term}”
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        ) : (
          <p className="type-caption text-subtle-foreground">Choose a verb to see how it fits.</p>
        )}
      </div>
    </section>
  );
}
