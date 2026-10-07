/**
 * Small, deterministic text tools for search: stopwords, a light stemmer for matching intent
 * triggers, edit distance and the typo acceptance rule. No models, no dictionaries.
 */

export const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
  "is",
  "are",
  "be",
  "it",
  "this",
  "that",
  "i",
  "me",
  "my",
  "we",
  "you",
  "with",
  "about",
  "some",
  "very",
  "really",
  "word",
  "words",
]);

/** Words that carry meaning in a phrase, stemmed: "giving an example" → ["giv", "exampl"]. */
export function contentStems(normalised: string) {
  return normalised
    .split(" ")
    .filter((word) => word && !STOPWORDS.has(word))
    .map(stem);
}

/**
 * A deliberately crude stemmer, good enough to match "giving" with "give" and "increased" with
 * "increase" in trigger phrases. It is never used to change what a learner sees.
 */
export function stem(word: string) {
  let w = word.replace(/'s$/, "");
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w.length > 3 ? w.replace(/e$/, "") : w;
}

/** Optimal string alignment distance: insertions, deletions, substitutions and swaps cost 1. */
export function editDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/** Terms shorter than this are never corrected: too many real words are one letter apart. */
export const MIN_TYPO_LENGTH = 4;

/** 1 edit for 4–7 characters, 2 for 8 or more (docs/ARCHITECTURE.md → Search). */
export function allowedEdits(term: string) {
  return term.length >= 8 ? 2 : 1;
}

export type TypoOutcome =
  | { kind: "corrected"; to: string; distance: number }
  | { kind: "ambiguous"; options: string[] }
  | { kind: "none" };

/**
 * Picks a correction from candidate terms: only within the allowed distance, and only when
 * exactly one candidate is closest. A tie is reported, never guessed.
 */
export function chooseCorrection(term: string, candidates: readonly string[]): TypoOutcome {
  if (term.length < MIN_TYPO_LENGTH || STOPWORDS.has(term)) return { kind: "none" };
  const limit = allowedEdits(term);
  const scored = [...new Set(candidates)]
    .filter((candidate) => candidate !== term)
    .map((candidate) => ({ candidate, distance: editDistance(term, candidate) }))
    .filter(({ distance }) => distance <= limit)
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));
  if (scored.length === 0) return { kind: "none" };
  const best = scored.filter(({ distance }) => distance === scored[0]!.distance);
  if (best.length > 1)
    return { kind: "ambiguous", options: best.map(({ candidate }) => candidate) };
  return { kind: "corrected", to: best[0]!.candidate, distance: best[0]!.distance };
}

/**
 * Trigram similarity in the style of PostgreSQL's pg_trgm (words padded with two spaces before
 * and one after), for the in-memory repository used in tests.
 */
export function trigramSimilarity(a: string, b: string) {
  const grams = (text: string) => {
    const set = new Set<string>();
    for (const word of text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      const padded = `  ${word} `;
      for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    }
    return set;
  };
  const x = grams(a);
  const y = grams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const gram of x) if (y.has(gram)) shared++;
  return shared / (x.size + y.size - shared);
}
