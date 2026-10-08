"use client";

import { LanguageResultCard } from "@/components/lexora/language-result-card";
import type { SearchResult } from "@/language/search/types";

import { toCardProps } from "./card-props";
import { useSavedSense } from "./saved-language";

/**
 * A search result card with the save action. It saves the result's sense — for a collocation
 * card, the meaning it belongs to — and names that sense. Visitors who save see the save gate.
 */
export function SaveableResultCard({
  result,
  className,
}: {
  result: SearchResult;
  className?: string;
}) {
  const label = result.senseLabel ? `${result.headword} — ${result.senseLabel}` : result.headword;
  const { saved, loading, pending, toggle } = useSavedSense({
    senseId: result.senseId,
    label,
  });
  return (
    <LanguageResultCard
      {...toCardProps(result)}
      className={className}
      saved={saved}
      saveLabel={label}
      saveBusy={loading || pending}
      onSaveToggle={toggle}
    />
  );
}
