/**
 * Phase 1 prototype content — NOT the language dataset.
 * Replaced by curated, validated content in Phase 3 (see docs/ARCHITECTURE.md).
 * Only UI code may import from src/demo; domain and server code never will.
 */
import type { LanguageCategory } from "@/components/lexora/language-category";
import type { LearningStatus } from "@/components/lexora/status-badge";
import type { LanguageTag } from "@/components/lexora/tag-badge";

export type Register = Extract<LanguageTag, "academic" | "formal" | "neutral" | "informal">;
export type Skill = Extract<LanguageTag, "writing" | "speaking">;
export type Strength = 1 | 2 | 3;

export type DemoExample = {
  text: string;
  /** Substring of `text` to mark with the highlighter. */
  highlight: string;
  skill: Skill;
};

export type DemoMistake = {
  wrong: string;
  right: string;
  why: string;
};

export type DemoRelation = {
  relation:
    "Stronger" | "Weaker" | "Similar" | "More formal" | "More natural" | "Opposite" | "Related";
  term: string;
  /** Links to a detail page when the item exists in the demo set. */
  slug?: string;
};

export type DemoLanguageItem = {
  slug: string;
  term: string;
  category: LanguageCategory;
  partOfSpeech: string;
  /** Only where verified. */
  ipa?: string;
  /** CEFR level, used as the learner-facing difficulty. */
  level: "B1" | "B2" | "C1" | "C2";
  register: Register[];
  strength?: Strength;
  skills: Skill[];
  meaning: string;
  pattern?: string;
  collocations?: { phrase: string; note: string }[];
  examples: DemoExample[];
  /** When the item works particularly well. */
  bestWhen: string;
  /** "Don't use it when…" warning. */
  avoidWhen?: string;
  usage?: { writing: DemoExample; speaking: DemoExample; note: string };
  mistakes?: DemoMistake[];
  related?: DemoRelation[];
  /** Sample learner status for the prototype. */
  status?: LearningStatus;
};
