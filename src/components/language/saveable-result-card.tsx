"use client";

import { LanguageResultCard } from "@/components/lexora/language-result-card";
import type { LanguageItem } from "@/language/types";

import { toCardProps } from "./card-props";
import { useSavedLanguage } from "./saved-language";

/** A result card with the save action. Visitors who save see the save gate. */
export function SaveableResultCard({
  item,
  className,
}: {
  item: LanguageItem;
  className?: string;
}) {
  const { isSaved, toggle } = useSavedLanguage();
  return (
    <LanguageResultCard
      {...toCardProps(item)}
      className={className}
      saved={isSaved(item.slug)}
      onSaveToggle={() => toggle({ slug: item.slug, term: item.term })}
    />
  );
}
