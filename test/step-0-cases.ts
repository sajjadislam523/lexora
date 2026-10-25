import type { GoldenCase } from "./golden";

/**
 * Phase 5 Step 0 search fixes (docs/specs/phase-5-retrieval-loop.md §5.G, §38 Step 0), checked
 * with the golden harness on both repositories. They live here rather than in
 * test/search-golden.yaml because the ranking snapshot covers every golden query, and Step 0
 * leaves the golden suite and the snapshot byte for byte unchanged.
 */
export const STEP_0_CASES: GoldenCase[] = [
  // An authored intent trigger on its own is that intent, as "I want to …" is.
  {
    query: "express contrast",
    intent: "CONTEXTUAL_EXPRESSION",
    includes: ["however", "whereas", "on the other hand"],
  },
  {
    query: "describe an increase",
    intent: "CONTEXTUAL_EXPRESSION",
    includes: ["rise sharply", "considerable"],
  },
  // Content expansion: "for example" now leads the give-an-example intent.
  {
    query: "Give an example?",
    intent: "CONTEXTUAL_EXPRESSION",
    top: ["for example", "for instance"],
    includes: ["such as", "a case in point"],
  },
  { query: "  SHOW   a result ", intent: "CONTEXTUAL_EXPRESSION", top: ["as a result"] },
  // The prefixed phrasings are unchanged.
  {
    query: "I want to express contrast",
    intent: "CONTEXTUAL_EXPRESSION",
    includes: ["however", "whereas", "on the other hand"],
  },
  {
    query: "how to express contrast",
    intent: "CONTEXTUAL_EXPRESSION",
    includes: ["however", "whereas", "on the other hand"],
  },
  // Only exact triggers: part of one, or one with more words, stays an ordinary lookup. (Since the
  // content expansion, "express" finds "express an opinion" in full text and "contrast" is an item.)
  { query: "express", intent: "LOOKUP", outcome: "fallback" },
  { query: "contrast", intent: "LOOKUP", top: ["contrast"] },
  {
    query: "important",
    intent: "LOOKUP",
    term: { via: "exact", resolved: "important" },
    top: ["important"],
  },
  // Extra-words mistakes ("such as for example Japan") show only with a neighbouring word:
  // "for example" alone is correct language.
  // "for example" has been an item since the content expansion.
  { query: "for example", intent: "LOOKUP", top: ["for example"], mistakes: [] },
  {
    query: "such as for example",
    intent: "LOOKUP",
    only: ["such as"],
    mistakes: ["Some countries, such as for example Japan, have ageing populations."],
  },
  // Legitimate mistakes are unchanged.
  {
    query: "responsible of",
    intent: "LOOKUP",
    only: ["responsible for"],
    mistakes: ["responsible of"],
  },
  {
    query: "a very crucial role",
    intent: "LOOKUP",
    only: ["play a crucial role"],
    mistakes: ["play a very crucial role"],
  },
];

/**
 * Queries that contain a trigger with more words, so they stay ordinary lookups. Only the reading
 * is pinned: their full-text fallback differs between the repositories (a known test artifact).
 */
export const NOT_TRIGGERS = ["express contrast in writing", "words to express contrast"];
