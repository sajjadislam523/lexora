import type { LanguageResultCardProps } from "@/components/lexora/language-result-card";
import type { LanguageCategory } from "@/components/lexora/language-category";
import type { SearchResult } from "@/language/search/types";
import type { ItemKind } from "@/language/schema/vocabulary";

/** The category colour for each kind of language item. */
export const CATEGORY_BY_KIND: Record<ItemKind, LanguageCategory> = {
  word: "vocabulary",
  phrase: "expression",
  collocation: "collocation",
  preposition_pattern: "preposition",
  linker: "linker",
  sentence_pattern: "pattern",
  functional_expression: "expression",
};

/** Maps a search result onto the result card. Everything shown comes from the engine. */
export function toCardProps(
  result: SearchResult,
): Omit<LanguageResultCardProps, "saved" | "onSaveToggle" | "className"> {
  const span = result.example?.highlights[0];
  return {
    term: result.term,
    category: CATEGORY_BY_KIND[result.kind],
    ...(result.senseLabel && { senseLabel: result.senseLabel }),
    reason: result.reason,
    meaning: result.definition,
    bestWhen: result.bestWhen,
    ...(result.pattern && !result.collocations?.length && { pattern: result.pattern }),
    ...(result.collocations?.length && { collocations: result.collocations.slice(0, 4) }),
    ...(result.example && {
      example: {
        text: result.example.text,
        ...(span && { highlight: result.example.text.slice(span.start, span.end) }),
      },
    }),
    tags: [...result.registers, ...result.skills],
    ...(result.strength && { strength: result.strength }),
    href: `/language/${result.slug}`,
  };
}
