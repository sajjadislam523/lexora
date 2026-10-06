"use client";

import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { findNavEntry } from "./navigation";
import { useShell } from "./shell-provider";

/** 48px bar above every app page: location on the left, global actions on the right. */
export function TopBar() {
  const pathname = usePathname();
  const { setMobileNavOpen, setPaletteOpen } = useShell();
  const entry = findNavEntry(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur-sm sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <span className="type-caption text-subtle-foreground max-sm:hidden">Lexora</span>
        <span aria-hidden className="text-subtle-foreground max-sm:hidden">
          /
        </span>
        <span className="truncate type-label text-foreground">{entry?.label ?? "Lexora"}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline" title="Static visual prototype — nothing is saved">
          Prototype
        </Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
        >
          <Search />
        </Button>
      </div>
    </header>
  );
}
