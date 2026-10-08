"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { findNavEntry, resolveBreadcrumb } from "./navigation";
import { useShell } from "./shell-provider";

/** 48px bar above every app page: location on the left, global actions on the right. */
export function TopBar() {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen, paletteOpen, setPaletteOpen } = useShell();
  const crumb = resolveBreadcrumb(pathname);
  const prototype = findNavEntry(pathname)?.prototype;

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur-sm sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={mobileNavOpen}
      >
        <Menu />
      </Button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        {crumb.parent ? (
          <Link
            href={crumb.parent.href}
            className="truncate type-caption text-subtle-foreground hover:text-foreground"
          >
            {crumb.parent.label}
          </Link>
        ) : (
          <span className="type-caption text-subtle-foreground max-sm:hidden">Lexora</span>
        )}
        <span
          aria-hidden
          className={
            crumb.parent ? "text-subtle-foreground" : "text-subtle-foreground max-sm:hidden"
          }
        >
          /
        </span>
        <span aria-current="page" className="truncate type-label text-foreground">
          {crumb.label}
        </span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {prototype ? (
          <Badge variant="outline" title={prototype}>
            Prototype<span className="sr-only">: {prototype}</span>
          </Badge>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          aria-haspopup="dialog"
          aria-expanded={paletteOpen}
        >
          <Search />
        </Button>
      </div>
    </header>
  );
}
