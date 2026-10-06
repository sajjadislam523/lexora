/**
 * Visual vocabulary for the kinds of language Lexora surfaces.
 *
 * This is presentation config only. When the language engine lands (Phase 3) the canonical
 * category enum will live in the domain layer and this map will be keyed by it.
 * Class names are written out in full so Tailwind can detect them statically.
 */
export const LANGUAGE_CATEGORIES = {
  vocabulary: {
    label: "Vocabulary",
    badge: "bg-cat-vocabulary-soft text-cat-vocabulary border-cat-vocabulary-line",
    dot: "bg-cat-vocabulary",
    soft: "bg-cat-vocabulary-soft",
    icon: "text-cat-vocabulary",
  },
  synonym: {
    label: "Synonym",
    badge: "bg-cat-synonym-soft text-cat-synonym border-cat-synonym-line",
    dot: "bg-cat-synonym",
    soft: "bg-cat-synonym-soft",
    icon: "text-cat-synonym",
  },
  preposition: {
    label: "Preposition",
    badge: "bg-cat-preposition-soft text-cat-preposition border-cat-preposition-line",
    dot: "bg-cat-preposition",
    soft: "bg-cat-preposition-soft",
    icon: "text-cat-preposition",
  },
  collocation: {
    label: "Collocation",
    badge: "bg-cat-collocation-soft text-cat-collocation border-cat-collocation-line",
    dot: "bg-cat-collocation",
    soft: "bg-cat-collocation-soft",
    icon: "text-cat-collocation",
  },
  linker: {
    label: "Linker",
    badge: "bg-cat-linker-soft text-cat-linker border-cat-linker-line",
    dot: "bg-cat-linker",
    soft: "bg-cat-linker-soft",
    icon: "text-cat-linker",
  },
  pattern: {
    label: "Sentence pattern",
    badge: "bg-cat-pattern-soft text-cat-pattern border-cat-pattern-line",
    dot: "bg-cat-pattern",
    soft: "bg-cat-pattern-soft",
    icon: "text-cat-pattern",
  },
  expression: {
    label: "Expression",
    badge: "bg-cat-expression-soft text-cat-expression border-cat-expression-line",
    dot: "bg-cat-expression",
    soft: "bg-cat-expression-soft",
    icon: "text-cat-expression",
  },
} as const;

export type LanguageCategory = keyof typeof LANGUAGE_CATEGORIES;

export const LANGUAGE_CATEGORY_KEYS = Object.keys(LANGUAGE_CATEGORIES) as LanguageCategory[];
