"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useSavedSense, type SaveTarget } from "./saved-language";

/**
 * The labelled save toggle for one sense on a language page. Its accessible name says exactly
 * which meaning is saved; visitors who press it see the save gate.
 */
export function SaveLanguageButton({
  target,
  text = { save: "Save to language bank", saved: "Saved" },
  size,
}: {
  target: SaveTarget;
  /** Visible labels; on a page with several meanings, "Save this meaning". */
  text?: { save: string; saved: string };
  size?: "sm";
}) {
  const { saved, loading, pending, toggle } = useSavedSense(target);

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size={size}
      aria-pressed={saved}
      aria-busy={loading || pending}
      aria-label={
        saved
          ? `Saved — remove “${target.label}” from your language bank`
          : `Save “${target.label}” to your language bank`
      }
      onClick={toggle}
      className={saved ? "text-ink" : undefined}
    >
      {saved ? <BookmarkCheck data-icon="inline-start" /> : <Bookmark data-icon="inline-start" />}
      {saved ? text.saved : text.save}
    </Button>
  );
}
