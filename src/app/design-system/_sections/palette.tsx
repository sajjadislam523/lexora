"use client";

import { BarChart3, BookMarked, Dumbbell, Home, Search } from "lucide-react";
import { createContext, use, useEffect, useState } from "react";

import { SearchTrigger } from "@/components/lexora/search-trigger";
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

import { SAMPLE_QUERIES } from "../_fixtures";

const JUMP_TO = [
  { label: "Home", icon: Home },
  { label: "Language Finder", icon: Search },
  { label: "Language bank", icon: BookMarked },
  { label: "Practice", icon: Dumbbell },
  { label: "Progress", icon: BarChart3 },
];

const PaletteContext = createContext<(() => void) | null>(null);

/**
 * Demo command palette for the playground. ⌘K / Ctrl+K or any DemoSearchTrigger opens it.
 * Items are static; selecting one only closes the palette.
 */
export function PaletteProvider({ children }: { children: React.ReactNode }) {
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
    <PaletteContext value={() => setOpen(true)}>
      {children}
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
              {JUMP_TO.map((item, index) => (
                <CommandItem key={item.label} onSelect={() => setOpen(false)}>
                  <item.icon />
                  {item.label}
                  <CommandShortcut>G {index + 1}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-border-subtle px-3 py-2 type-caption text-subtle-foreground">
            Prototype — items are static and selecting one only closes the palette.
          </div>
        </Command>
      </CommandDialog>
    </PaletteContext>
  );
}

export function DemoSearchTrigger({ className }: { className?: string }) {
  const openPalette = use(PaletteContext);
  return <SearchTrigger className={className} onClick={() => openPalette?.()} />;
}
