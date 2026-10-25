/**
 * Deterministic ranking (docs/ARCHITECTURE.md → Search ranking). Each candidate has a score
 * tuple compared left to right; equal tuples fall back to authored position, then the term A–Z.
 * No learned weights and no popularity: every placement can be explained.
 */
import type { IeltsRelevance, RelationType } from "../schema/vocabulary";

import type { Modifier, SearchResult } from "./types";

/** 1 exact term · 2 exact phrase · 3 intent or relation · 4 variant or typo · 5 collocation or context · 6 related or full text. */
export type MatchTier = 1 | 2 | 3 | 4 | 5 | 6;

export type Candidate = {
  result: SearchResult;
  tier: MatchTier;
  /**
   * Phase 6B, relations: 0 when the result can take the term's place in a sentence (the same
   * word class), 1 when it can't ("in my opinion" for the verb "think"). Default 0.
   */
  classFit?: number;
  /** Editorial weight 1–3 (relations), or 0. */
  weight: number;
  relevance: IeltsRelevance;
  /** Lower is better: relation type order for the question asked. */
  typePriority: number;
  /** Authored order (sense position, entry position). */
  position: number;
  /** Filled in by rank(). */
  modifierFit?: number;
  /** Filled in by rank(): modifiers the relation type itself states (more_formal for "formal"). */
  relationFit?: number;
};

const RELEVANCE_ORDER: Record<IeltsRelevance, number> = { core: 0, high: 1, useful: 2 };

/** For synonym-style questions: closest meaning first, weaker alternatives last. */
export const RELATION_PRIORITY: Partial<Record<RelationType, number>> = {
  synonym: 0,
  stronger: 1,
  alternative: 2,
  more_formal: 3,
  more_natural: 3,
  weaker: 4,
  confusable: 5,
  opposite: 6,
  has_component: 7,
  component_of: 7,
  derived_form: 8,
  related: 9,
};

/** How many of the query's modifiers a result satisfies. */
export function modifierFit(
  result: SearchResult,
  modifiers: readonly Modifier[],
  relationType?: RelationType,
) {
  let fit = 0;
  for (const modifier of modifiers) {
    const ok =
      modifier === "writing" || modifier === "speaking"
        ? result.skills.includes(modifier)
        : modifier === "academic"
          ? result.registers.includes("academic")
          : modifier === "formal"
            ? relationType === "more_formal" ||
              result.registers.includes("formal") ||
              result.registers.includes("academic")
            : // informal and natural
              relationType === "more_natural" ||
              result.registers.includes("informal") ||
              (modifier === "natural" &&
                result.skills.includes("speaking") &&
                !result.registers.includes("formal"));
    if (ok) fit++;
  }
  return fit;
}

/**
 * Modifiers an authored relation type states outright: "more formal" answers a formal or
 * academic request, "more natural" a natural or informal one.
 */
export function relationFit(modifiers: readonly Modifier[], relationType?: RelationType) {
  return modifiers.filter((modifier) =>
    modifier === "formal" || modifier === "academic"
      ? relationType === "more_formal"
      : modifier === "natural" || modifier === "informal"
        ? relationType === "more_natural"
        : false,
  ).length;
}

/**
 * Tier, then (Phase 6B) word-class fit and what the learner asked for — the modifiers a result
 * satisfies, then those its relation states — before editorial weight; then relevance, relation
 * type, authored position and term.
 */
export function compareCandidates(a: Candidate, b: Candidate) {
  return (
    a.tier - b.tier ||
    (a.classFit ?? 0) - (b.classFit ?? 0) ||
    (b.modifierFit ?? 0) - (a.modifierFit ?? 0) ||
    (b.relationFit ?? 0) - (a.relationFit ?? 0) ||
    b.weight - a.weight ||
    RELEVANCE_ORDER[a.relevance] - RELEVANCE_ORDER[b.relevance] ||
    a.typePriority - b.typePriority ||
    a.position - b.position ||
    a.result.term.localeCompare(b.result.term)
  );
}

/**
 * Ranks candidates and keeps the best one per key. A skill modifier ("speaking") filters out
 * results not used in that skill, unless that would leave nothing.
 */
export function rank(
  candidates: Candidate[],
  modifiers: readonly Modifier[] = [],
  relationOf: (candidate: Candidate) => RelationType | undefined = () => undefined,
): SearchResult[] {
  let pool = candidates.map((candidate) => ({
    ...candidate,
    modifierFit: modifierFit(candidate.result, modifiers, relationOf(candidate)),
    relationFit: relationFit(modifiers, relationOf(candidate)),
  }));
  for (const skill of ["speaking", "writing"] as const) {
    if (!modifiers.includes(skill)) continue;
    const kept = pool.filter((candidate) => candidate.result.skills.includes(skill));
    if (kept.length > 0) pool = kept;
  }
  const seen = new Set<string>();
  return pool
    .sort(compareCandidates)
    .filter((candidate) => {
      if (seen.has(candidate.result.key)) return false;
      seen.add(candidate.result.key);
      return true;
    })
    .map((candidate) => candidate.result);
}
