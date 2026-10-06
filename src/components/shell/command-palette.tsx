"use client";

import { BookOpen, PanelLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";

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

import { DEMO_QUERIES } from "@/demo/finder";
import { DEMO_LANGUAGE } from "@/demo/language";

import { PRIMARY_NAV, SECONDARY_NAV } from "./navigation";
import { useShell } from "./shell-provider";

/**
 * Global command palette (⌘K / Ctrl+K). Navigation and shell actions are real. In the prototype,
 * "language" results are the example searches and sample items — real search arrives in Phase 4.
 */
export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, toggleCollapsed } = useShell();

  function run(action: () => void) {
    setPaletteOpen(false);
    action();
  }

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="Command palette"
      description="Jump to a page or run an action"
      className="sm:max-w-xl"
    >
      <Command>
        <CommandInput placeholder="Jump to a page, an example search or a word…" />
        <CommandList className="max-h-80">
          <CommandEmpty>No matching pages or actions.</CommandEmpty>
          <CommandGroup heading="Go to">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].map((entry) => (
              <CommandItem
                key={entry.id}
                value={`${entry.label} ${entry.description}`}
                onSelect={() => run(() => router.push(entry.href))}
              >
                <entry.icon />
                {entry.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Example searches">
            {DEMO_QUERIES.filter((q) => q.mode !== "context").map((query) => (
              <CommandItem
                key={query.id}
                value={`search ${query.text}`}
                onSelect={() =>
                  run(() => router.push(`/finder?q=${encodeURIComponent(query.text)}`))
                }
              >
                <Search />
                {query.text}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Sample language">
            {DEMO_LANGUAGE.map((item) => (
              <CommandItem
                key={item.slug}
                value={`language ${item.term} ${item.meaning}`}
                onSelect={() => run(() => router.push(`/language/${item.slug}`))}
              >
                <BookOpen />
                <span className="type-term-sm">{item.term.replace(/,$/, "")}</span>
                <CommandShortcut className="font-sans tracking-normal max-sm:hidden">
                  {item.partOfSpeech}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              value="Toggle sidebar collapse"
              onSelect={() => run(toggleCollapsed)}
              className="max-lg:hidden"
            >
              <PanelLeft />
              Toggle sidebar
              <CommandShortcut>⌘\</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="border-t border-border-subtle px-3 py-2 type-caption text-subtle-foreground">
          Prototype — example searches and sample language only. Real search arrives in Phase 4.
        </div>
      </Command>
    </CommandDialog>
  );
}
