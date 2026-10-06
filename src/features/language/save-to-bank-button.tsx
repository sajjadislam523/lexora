"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSavedItems } from "@/demo/saved-items";

/** Save toggle backed by session-only prototype state. The caption says so. */
export function SaveToBankButton({ slug, term }: { slug: string; term: string }) {
  const { isSaved, toggle } = useSavedItems();
  const saved = isSaved(slug);

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      aria-pressed={saved}
      aria-label={
        saved
          ? `Saved — remove "${term}" from your language bank`
          : `Save "${term}" to your language bank`
      }
      onClick={() => toggle(slug)}
      className={saved ? "text-ink" : undefined}
    >
      {saved ? <BookmarkCheck data-icon="inline-start" /> : <Bookmark data-icon="inline-start" />}
      {saved ? "Saved" : "Save to language bank"}
    </Button>
  );
}
