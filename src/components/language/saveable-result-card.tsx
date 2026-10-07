"use client";

import { LanguageResultCard } from "@/components/lexora/language-result-card";
import type { SearchResult } from "@/language/search/types";

import { toCardProps } from "./card-props";
import { useSavedLanguage } from "./saved-language";

/** A search result card with the save action. Visitors who save see the save gate. */
export function SaveableResultCard({
  result,
  className,
}: {
  result: SearchResult;
  className?: string;
}) {
  const { isSaved, toggle } = useSavedLanguage();
  return (
    <LanguageResultCard
      {...toCardProps(result)}
      className={className}
      saved={isSaved(result.slug)}
      onSaveToggle={() => toggle({ slug: result.slug, term: result.term })}
    />
  );
}
