/**
 * The search contract: what LanguageSearchService returns for a query. Content only — the same
 * query gives every visitor the same response; saved state is added in the browser.
 */
import type { SearchFilters } from "../filters";
import type { Quality } from "./descriptors";
import type { GapVerdict } from "./gap/verdicts";
import type { SenseSummary, Span } from "../model";
import type { IeltsTask, ItemKind, Register, Skill } from "../schema/vocabulary";

import type { FilterCounts } from "./repository";

/** The shape of a question, recognised by the ordered patterns in classify.ts. */
export const QUERY_INTENTS = [
  "SYNONYM",
  "STRONGER_ALTERNATIVE",
  "WEAKER_ALTERNATIVE",
  "ALTERNATIVE",
  "PREPOSITION",
  "COLLOCATION",
  "LINKER",
  "PHRASE",
  "SENTENCE_PATTERN",
  "CONTEXTUAL_EXPRESSION",
  "CONTEXT_GAP",
  "LOOKUP",
] as const;
export type QueryIntent = (typeof QUERY_INTENTS)[number];

/** Words in a query that narrow the results: "natural speaking alternative to …". */
export const MODIFIERS = [
  "writing",
  "speaking",
  "formal",
  "academic",
  "informal",
  "natural",
] as const;
export type Modifier = (typeof MODIFIERS)[number];

/** How a typed term was matched to Lexora's language. */
export type TermResolution = {
  input: string;
  resolved: string;
  via: "exact" | "variant" | "typo";
  /** For variants: "US spelling of analyse". */
  note?: string;
  /** For variants: the region of the spelling that was typed. */
  region?: "gb" | "us";
};

/**
 * What a blank was read as (Phase 4 Step 4): the first kind of structure that answered it, in the
 * order verb frame, preposition pattern, collocation, linker. `unknown`: read, but nothing in
 * Lexora answers it.
 */
export type GapType = "verb_frame" | "preposition" | "collocation" | "linker" | "unknown";

/** One blank of a context-gap query, in order (at most two). */
export type GapSlot = {
  index: 0 | 1;
  /** The blank's position among the words of `normalised` (its `___` token). */
  at: number;
  /** What the learner typed: underscores, or an ellipsis between words. */
  marker: "underscore" | "ellipsis";
  type: GapType;
};

/** Context-gap fit: does this verb work in the learner's sentence? */
export type GapFit = "fits" | "different_preposition" | "unlikely";

export type SearchResult = {
  /** Unique within the response. */
  key: string;
  /** The sense a save stores. */
  senseId: string;
  slug: string;
  /** What the card shows as the term: a headword, a collocation or a pattern. */
  term: string;
  /** The item the saved sense belongs to (the term may be one of its collocations). */
  headword: string;
  kind: ItemKind;
  senseLabel?: string;
  definition: string;
  bestWhen: string;
  registers: Register[];
  skills: Skill[];
  strength?: 1 | 2 | 3;
  example?: { text: string; highlights: Span[] };
  collocations?: string[];
  pattern?: string;
  /** Why this result is here, in plain words. Every result has one. */
  reason: string;
  fit?: GapFit;
  /** Context-gap results: the word for the gap and the preposition it takes here. */
  fill?: { word: string; preposition?: string };
  /**
   * Context-gap candidates (Steps 4.2–4.3): which blank, what kind of structure, the authored
   * structure, and the context-fit verdict with its evidence. Verb-frame results also keep their
   * Phase 3 `fit`.
   */
  gapMatch?: {
    gap: 0 | 1;
    /**
     * Step 4.5: both blanks, for one authored structure that fills them together (a verb frame or
     * a preposition pattern on a phrase): `fill.word` goes in the first, `fill.preposition` in the
     * second. Absent for a candidate that fills one blank.
     */
    gaps?: [0, 1];
    type: "verb_frame" | "preposition" | "collocation" | "linker";
    /** The authored structure's id (a verb frame's display text: frames carry no id here). */
    evidence: string;
    /** Step 4.3: how well it fits this sentence, from authored evidence (never a score). */
    verdict: GapVerdict;
    /** The evidence behind the verdict, as stable codes ("pattern", "authored_mistake"…). */
    signals: string[];
  };
};

export type ResultGroup = { label?: string; results: SearchResult[] };

export type FitGuide = { title: string; rows: { term: string; when: string }[]; note?: string };

export type SearchResponse = {
  query: string;
  normalised: string;
  interpretation: {
    intent: QueryIntent;
    /** How the query was read: "Stronger alternatives to “important”". */
    summary: string;
    term?: TermResolution;
    modifiers: Modifier[];
    /**
     * Phase 6B: a size or speed word read with the term ("large" in "a word for a large
     * increase"), and the qualities it asks for.
     */
    descriptor?: { word: string; qualities: Quality[] };
    /** Phase 6B: the IELTS task the query names; language used in it comes first. */
    task?: IeltsTask;
  };
  groups: ResultGroup[];
  guide?: FitGuide;
  mistakes: { wrong: string; right: string; explanation: string }[];
  /** Two equally close corrections: shown instead of guessing. */
  didYouMean?: string[];
  /** Context-gap queries: the object and preposition read after the gap. */
  gap?: { object?: string; preposition?: string };
  /** Context-gap queries: every blank read, in order (`query` is the learner's sentence). */
  gaps?: GapSlot[];
  /**
   * Set on an ordinary answer to a query whose blanks Lexora didn't read: more than two
   * (Step 4 reads at most two).
   */
  gapNote?: "too_many_gaps";
  /** `fallback`: full-text matches only, labelled as such. `none`: nothing matched. */
  outcome: "results" | "fallback" | "none";
  /**
   * Only when filters were applied: the filters, and how many results the search found before
   * and after them. `before > 0` with `after === 0` means the filters hid every result.
   */
  filters?: { applied: SearchFilters; before: number; after: number };
};

/** Browsing by filters, without a query (`LanguageSearchService.browse`). */
export type BrowseResponse = {
  filters: SearchFilters;
  page: number;
  pageSize: number;
  /** Matching senses in total, across pages. */
  total: number;
  /** At least 1. */
  pages: number;
  /** This page's senses, in browse order. Empty when `page` is past the last page. */
  items: SenseSummary[];
  /** Matches per value of each dimension, with the other dimensions' filters applied. */
  counts: FilterCounts;
};

/** Builds a result from a sense summary, with the reason it appears. */
export function resultFrom(
  summary: SenseSummary,
  reason: string,
  overrides: Partial<SearchResult> = {},
): SearchResult {
  return {
    key: summary.senseId,
    senseId: summary.senseId,
    slug: summary.slug,
    term: summary.headword,
    headword: summary.headword,
    kind: summary.kind,
    ...(summary.senseLabel && { senseLabel: summary.senseLabel }),
    definition: summary.definition,
    bestWhen: summary.bestWhen,
    registers: summary.registers,
    skills: summary.skills,
    ...(summary.strength && { strength: summary.strength }),
    ...(summary.example && { example: summary.example }),
    ...(summary.collocations.length > 0 && { collocations: summary.collocations }),
    ...(summary.pattern && { pattern: summary.pattern }),
    reason,
    ...overrides,
  };
}
