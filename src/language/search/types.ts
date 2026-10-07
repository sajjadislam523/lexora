/**
 * The search contract: what LanguageSearchService returns for a query. Content only — the same
 * query gives every visitor the same response; saved state is added in the browser.
 */
import type { SenseSummary, Span } from "../model";
import type { ItemKind, Register, Skill } from "../schema/vocabulary";

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
  };
  groups: ResultGroup[];
  guide?: FitGuide;
  mistakes: { wrong: string; right: string; explanation: string }[];
  /** Two equally close corrections: shown instead of guessing. */
  didYouMean?: string[];
  /** Context-gap queries: the object and preposition read after the gap. */
  gap?: { object?: string; preposition?: string };
  /** `fallback`: full-text matches only, labelled as such. `none`: nothing matched. */
  outcome: "results" | "fallback" | "none";
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
