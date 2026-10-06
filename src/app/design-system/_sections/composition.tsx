"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { FilterChip } from "@/components/lexora/filter-chip";
import { Kbd } from "@/components/lexora/kbd";
import type { LanguageCategory } from "@/components/lexora/language-category";
import { LanguageResultCard } from "@/components/lexora/language-result-card";
import { NavItem } from "@/components/lexora/nav-item";
import { PageHeader } from "@/components/lexora/page-header";
import { SearchField } from "@/components/lexora/search-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { SAMPLE_RESULTS } from "../_fixtures";
import { NAV_PREVIEW } from "./components";
import { DemoSearchTrigger } from "./palette";
import { Section } from "./section";

const CHIP_KEYS: LanguageCategory[] = [
  "preposition",
  "synonym",
  "linker",
  "collocation",
  "expression",
  "pattern",
];

/**
 * A static composition showing the system working together. It is NOT the application:
 * the chips filter the fixed sample list in memory, and nothing else is functional.
 */
export function CompositionSection() {
  const [active, setActive] = useState<Set<LanguageCategory>>(() => new Set());

  const toggle = (key: LanguageCategory) =>
    setActive((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const results = SAMPLE_RESULTS.filter((r) => active.size === 0 || active.has(r.category));

  return (
    <Section
      id="composition"
      eyebrow="Composition"
      title="The system, assembled"
      description="A framed preview of a Finder-like screen built only from tokens and components on this page. It exists to judge the whole, not to demonstrate features."
    >
      <figure className="overflow-hidden rounded-xl border border-border bg-background shadow-lg">
        <div className="flex h-9 items-center gap-2 border-b border-border bg-sidebar px-3">
          <span aria-hidden className="size-2.5 rounded-full bg-border-strong" />
          <span aria-hidden className="size-2.5 rounded-full bg-border-strong" />
          <span aria-hidden className="size-2.5 rounded-full bg-border-strong" />
          <Badge variant="outline" className="ml-auto">
            Composition preview — not the application
          </Badge>
        </div>

        <div className="flex">
          <aside className="hidden w-sidebar shrink-0 space-y-4 border-r border-border bg-sidebar p-3 md:block">
            <div className="flex items-center gap-2 px-2 pt-1">
              <span
                aria-hidden
                className="flex size-6 items-center justify-center rounded-sm bg-primary type-micro font-semibold text-primary-foreground"
              >
                L
              </span>
              <span className="type-label text-foreground">Lexora</span>
            </div>
            <DemoSearchTrigger />
            <nav aria-label="Preview navigation" className="space-y-0.5">
              {NAV_PREVIEW.map((item) => (
                <NavItem
                  key={item.label}
                  href="#composition"
                  label={item.label}
                  icon={item.icon}
                  active={item.active}
                  count={item.count}
                />
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-reading space-y-6">
              <PageHeader
                eyebrow="Language Finder"
                title="What do you want to say?"
                description="Describe the idea. Lexora finds the words, prepositions, linkers and patterns that fit."
              />
              <SearchField
                size="lg"
                label="Search for language (preview)"
                placeholder="I want to express contrast…"
                hint={<Kbd>/</Kbd>}
              />
              <div className="flex flex-wrap items-center gap-2">
                {CHIP_KEYS.map((key) => (
                  <FilterChip
                    key={key}
                    category={key}
                    pressed={active.has(key)}
                    onClick={() => toggle(key)}
                  />
                ))}
                <Button variant="ghost" size="sm" className="ml-auto shrink-0">
                  <SlidersHorizontal data-icon="inline-start" />
                  Filters
                </Button>
              </div>
              <p className="type-caption text-subtle-foreground">
                {results.length} sample {results.length === 1 ? "result" : "results"}
              </p>
              <div className="space-y-3">
                {results.map(({ id, ...result }) => (
                  <LanguageResultCard key={id} {...result} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </figure>
    </Section>
  );
}
