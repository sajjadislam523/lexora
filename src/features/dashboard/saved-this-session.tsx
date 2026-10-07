"use client";

import { BookMarked } from "lucide-react";
import Link from "next/link";

import { useSavedLanguage } from "@/components/language/saved-language";

/** Shows the session-only saved count, so saving elsewhere is visibly reflected here. */
export function SavedThisSession() {
  const { count } = useSavedLanguage();
  return (
    <Link
      href="/bank"
      className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-120 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BookMarked aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block type-label text-foreground">Open language bank</span>
        <span className="block type-caption text-muted-foreground">
          {count} saved this session · not stored yet
        </span>
      </span>
    </Link>
  );
}
