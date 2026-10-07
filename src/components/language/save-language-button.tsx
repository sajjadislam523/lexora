"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useSavedLanguage } from "./saved-language";

/** The labelled save toggle for a language page. Visitors who press it see the save gate. */
export function SaveLanguageButton({ slug, term }: { slug: string; term: string }) {
  const { isSaved, toggle } = useSavedLanguage();
  const saved = isSaved(slug);
  const label = term.replace(/,$/, "");

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      aria-pressed={saved}
      aria-label={
        saved
          ? `Saved — remove “${label}” from your language bank`
          : `Save “${label}” to your language bank`
      }
      onClick={() => toggle({ slug, term })}
      className={saved ? "text-ink" : undefined}
    >
      {saved ? <BookmarkCheck data-icon="inline-start" /> : <Bookmark data-icon="inline-start" />}
      {saved ? "Saved" : "Save to language bank"}
    </Button>
  );
}
