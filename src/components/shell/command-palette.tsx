"use client";

import { PanelLeft } from "lucide-react";
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

import { PRIMARY_NAV, SECONDARY_NAV } from "./navigation";
import { useShell } from "./shell-provider";

/**
 * Global command palette (⌘K / Ctrl+K). Navigation and shell actions are real.
 * Language search is not offered here until the Finder exists (Phase 4).
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
        <CommandInput placeholder="Jump to a page or run an action…" />
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
          Language search arrives with the Finder in Phase 4.
        </div>
      </Command>
    </CommandDialog>
  );
}
