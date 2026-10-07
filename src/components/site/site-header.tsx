"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useViewer } from "@/components/language/saved-language";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { Logo } from "./logo";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/#how-it-works", label: "How it works" },
];

/**
 * Header for public pages. Visitors see Sign in and Get started; a signed-in learner sees a way
 * back into the app. The session is checked in the browser, so public pages stay static.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const viewer = useViewer();
  const [menuOpen, setMenuOpen] = useState(false);
  const signedIn = viewer === "signed-in";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-page items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Logo />

        <nav aria-label="Main" className="max-md:hidden">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={cn(
                    "rounded-sm px-2.5 py-1.5 type-label text-muted-foreground transition-colors duration-120 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    pathname === link.href && "text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/home">Open Lexora</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="gap-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="type-label text-foreground">Lexora</SheetTitle>
            <SheetDescription className="type-caption text-muted-foreground">
              Find the English you mean.
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Main" className="p-2">
            <ul className="space-y-0.5">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-3 py-2.5 type-label text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
