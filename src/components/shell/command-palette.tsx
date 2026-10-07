"use client";

import { PanelLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

import { EXAMPLE_SEARCHES, searchHref } from "@/language/examples";

import { PRIMARY_NAV, SECONDARY_NAV } from "./navigation";
import { useShell } from "./shell-provider";

/**
 * Global command palette (⌘K / Ctrl+K): navigation, shell actions, and a way into the Language
 * Finder. Searching itself happens in the Finder, on the server; the palette holds no language.
 */
export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, toggleCollapsed } = useShell();
  const [typed, setTyped] = useState("");

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
        <CommandInput
          placeholder="Jump to a page, or search for language…"
          value={typed}
          onValueChange={setTyped}
        />
        <CommandList className="max-h-80">
          <CommandEmpty>No matching pages or actions.</CommandEmpty>
          {typed.trim() ? (
            <CommandGroup heading="Language Finder" forceMount>
              <CommandItem
                forceMount
                value={`find ${typed}`}
                onSelect={() => run(() => router.push(searchHref("/finder", typed)))}
              >
                <Search />
                Search for “{typed.trim()}”
              </CommandItem>
            </CommandGroup>
          ) : null}
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
            {EXAMPLE_SEARCHES.filter((example) => example.mode !== "context").map((example) => (
              <CommandItem
                key={example.id}
                value={`search ${example.text}`}
                onSelect={() => run(() => router.push(searchHref("/finder", example.text)))}
              >
                <Search />
                {example.text}
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
          Type what you want to say, then choose “Search for …” to open it in the Finder.
        </div>
      </Command>
    </CommandDialog>
  );
}
