"use client";

import { BarChart3, BookMarked, Dumbbell, Home, Mic, PenLine, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { CategoryBadge } from "@/components/lexora/category-badge";
import { Kbd } from "@/components/lexora/kbd";
import { LanguageResultCard } from "@/components/lexora/language-result-card";
import { NavItem } from "@/components/lexora/nav-item";
import { PageHeader } from "@/components/lexora/page-header";
import { SearchField } from "@/components/lexora/search-field";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

import { SAMPLE_QUERIES, SAMPLE_RESULTS } from "../_fixtures";
import { Section, Specimen } from "./section";

const NAV_PREVIEW = [
  { label: "Home", icon: Home },
  { label: "Language Finder", icon: Search, active: true },
  { label: "Language bank", icon: BookMarked, count: 48 },
  { label: "Practice", icon: Dumbbell, count: 12 },
  { label: "Writing Lab", icon: PenLine },
  { label: "Speaking Lab", icon: Mic },
  { label: "Progress", icon: BarChart3 },
];

function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Search data-icon="inline-start" />
          Open command palette
        </Button>
        <span className="inline-flex items-center gap-1 type-caption text-muted-foreground">
          or press <Kbd>⌘</Kbd>
          <Kbd>K</Kbd> / <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command palette"
        description="Search language or jump to a section"
        className="sm:max-w-xl"
      >
        <Command>
          <CommandInput placeholder="Search language or jump to…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No matches in this demo list.</CommandEmpty>
            <CommandGroup heading="Try searching">
              {SAMPLE_QUERIES.map((query) => (
                <CommandItem key={query} onSelect={() => setOpen(false)}>
                  <Search />
                  {query}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Jump to">
              {NAV_PREVIEW.slice(0, 4).map((item, index) => (
                <CommandItem key={item.label} onSelect={() => setOpen(false)}>
                  <item.icon />
                  {item.label}
                  <CommandShortcut>G {index + 1}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-border px-3 py-2 type-caption text-subtle-foreground">
            Prototype — items are static and selecting one only closes the palette.
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}

export function PatternsSection() {
  const [saved, setSaved] = useState<Set<string>>(() => new Set(["significant"]));

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Section
      id="patterns"
      eyebrow="Components"
      title="Lexora patterns"
      description="Product-specific components in src/components/lexora. Presentational: they render what they are given and own no data."
    >
      <Specimen title="Page header">
        <PageHeader
          eyebrow="Language Finder"
          title="Find the right English"
          description="Describe what you want to say. Lexora finds the words, prepositions, linkers and patterns that fit."
          actions={<Button variant="outline">Filters</Button>}
        />
      </Specimen>

      <Specimen
        title="Search field"
        note="Large for the Finder; medium for in-page filtering. Search is not wired up yet."
        className="bg-background"
      >
        <div className="mx-auto max-w-reading space-y-4">
          <SearchField
            size="lg"
            label="Search for language"
            placeholder="What do you want to say?"
            hint={<Kbd>/</Kbd>}
          />
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.slice(0, 4).map((query) => (
              <span
                key={query}
                className="rounded-md border border-border bg-card px-2.5 py-1 type-caption text-muted-foreground"
              >
                {query}
              </span>
            ))}
          </div>
          <SearchField label="Filter saved language" placeholder="Filter…" />
        </div>
      </Specimen>

      <Specimen
        title="Language result card"
        note="Sample content. The bookmark toggles local demo state only — nothing is persisted."
        className="bg-background"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {SAMPLE_RESULTS.map(({ id, ...result }) => (
            <LanguageResultCard
              key={id}
              {...result}
              saved={saved.has(id)}
              onSaveToggle={() => toggleSaved(id)}
            />
          ))}
        </div>
      </Specimen>

      <div className="grid gap-10 lg:grid-cols-2">
        <Specimen
          title="Sidebar navigation"
          note="Preview only. The real shell arrives in Phase 1."
          className="bg-sidebar"
        >
          <nav aria-label="Navigation preview" className="max-w-60 space-y-0.5">
            {NAV_PREVIEW.map((item) => (
              <NavItem
                key={item.label}
                href="#patterns"
                label={item.label}
                icon={item.icon}
                active={item.active}
                count={item.count}
              />
            ))}
          </nav>
        </Specimen>

        <Specimen title="Command palette" note="Keyboard-first navigation and search entry point.">
          <CommandPaletteDemo />
          <div className="mt-6 flex flex-wrap gap-2">
            <CategoryBadge category="linker" />
            <CategoryBadge category="preposition" />
            <CategoryBadge category="collocation" />
          </div>
          <p className="mt-2 type-caption text-subtle-foreground">
            Results in the palette will carry category badges once search exists.
          </p>
        </Specimen>
      </div>
    </Section>
  );
}
