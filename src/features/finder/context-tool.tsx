"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ChoiceOption } from "@/components/lexora/choice-option";
import { FitBadge } from "@/components/lexora/fit-badge";
import { GapSentence } from "@/components/lexora/gap-sentence";
import { CONTEXT_SENTENCE } from "@/demo/finder";
import { cn } from "@/lib/utils";

/**
 * The signature Lexora interaction: choose a word for a real sentence and see how well it fits,
 * including the preposition it brings with it. Exploration, not a test — every option explains itself.
 */
export function ContextTool({ className }: { className?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = CONTEXT_SENTENCE.options.find((option) => option.id === selectedId);

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
        <GapSentence parts={CONTEXT_SENTENCE.parts} fills={selected?.fills} />
      </div>

      <div role="group" aria-label="Choose a verb" className="mt-4 grid gap-2 sm:grid-cols-2">
        {CONTEXT_SENTENCE.options.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <ChoiceOption
              key={option.id}
              pressed={isSelected}
              state={isSelected ? "selected" : "idle"}
              language
              onClick={() => setSelectedId(option.id)}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {option.fills[0]}{" "}
                  <span className="text-muted-foreground">… {option.fills[1]}</span>
                </span>
                {selectedId ? <FitBadge fit={option.fit} /> : null}
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
                {selected.fills[0]} … {selected.fills[1]}
              </span>
              <FitBadge fit={selected.fit} />
            </p>
            <p className="type-body text-muted-foreground">{selected.note}</p>
            {selected.slug ? (
              <Link
                href={`/language/${selected.slug}`}
                className="inline-flex items-center gap-1 type-label text-ink hover:underline"
              >
                How to use “{selected.fills[0]}”
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="type-caption text-subtle-foreground">Choose a verb to see how it fits.</p>
        )}
      </div>
    </section>
  );
}
