import type { LanguageResultCardProps } from "@/components/lexora/language-result-card";
import type { DemoLanguageItem } from "@/demo/types";

/** Maps a demo language item onto the result card. */
export function toCardProps(
  item: DemoLanguageItem,
): Omit<LanguageResultCardProps, "saved" | "onSaveToggle" | "className"> {
  const example = item.examples[0];
  return {
    term: item.term,
    category: item.category,
    meaning: item.meaning,
    bestWhen: item.bestWhen,
    pattern: item.collocations?.length ? undefined : item.pattern,
    collocations: item.collocations?.slice(0, 4).map((c) => c.phrase),
    example: example ? { text: example.text, highlight: example.highlight } : undefined,
    tags: [...item.register, ...item.skills],
    strength: item.strength,
    href: `/language/${item.slug}`,
  };
}
