"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { SaveLanguageButton } from "@/components/language/save-language-button";
import { useViewer, type SaveTarget } from "@/components/language/saved-language";
import { useLastSearch } from "@/lib/last-search";

/**
 * Back to search: to the results this tab last showed, or else to search itself — the signed-in
 * Finder for learners, public Explore for visitors. The label is the same either way, so nothing
 * shifts once the session check resolves.
 */
export function BackToSearch() {
  const viewer = useViewer();
  const lastSearch = useLastSearch();
  return (
    <Link
      href={lastSearch ?? (viewer === "signed-in" ? "/finder" : "/explore")}
      className="-my-1 inline-flex items-center gap-1.5 rounded-sm py-1 type-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back to search
    </Link>
  );
}

/**
 * The page's save action. One meaning: a single Save for that sense. Several meanings: each
 * meaning has its own Save (in its block), so the header only says so — nothing saves a whole
 * word. Visitors who save see the save gate.
 */
export function LanguageActions({ target }: { target?: SaveTarget }) {
  if (target) return <SaveLanguageButton target={target} />;
  return (
    <p className="type-caption text-muted-foreground">
      Each meaning is saved on its own — use Save on the meaning you need.
    </p>
  );
}
