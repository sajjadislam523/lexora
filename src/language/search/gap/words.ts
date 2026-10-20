/**
 * The closed word lists the gap analysers read words with (Phase 4 Steps 4.2–4.4). They are
 * closed classes, not a dictionary: anything outside them is a content word.
 */
import { STOPWORDS } from "../text";

/** The prepositions a pattern can put after its base (a closed class). */
export const GAP_PREPOSITIONS = [
  "about",
  "against",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "to",
  "towards",
  "with",
] as const;

/** Words that start a noun phrase: what follows them is a noun phrase. */
export const DETERMINERS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "some",
  "any",
  "no",
  "every",
  "each",
  "many",
  "much",
  "more",
  "most",
  "several",
  "both",
]);

/**
 * The forms of "be" and "have" (Step 4.5, R-1). Before a collocation's first word they call for
 * a form the base word in the blank isn't ("It was playing", "Prices have risen"), so that side
 * is unchecked. Used only by that left-side rule: "have" and "has" stay content words elsewhere,
 * so they still anchor collocations and keep their authored inflection family.
 */
export const AUXILIARIES = new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "having",
]);

const PREPOSITION_SET = new Set<string>(GAP_PREPOSITIONS);

/** A stopword, a preposition or a determiner: a word that can't anchor or be checked as content. */
export function isFunctionWord(word: string) {
  return STOPWORDS.has(word) || PREPOSITION_SET.has(word) || DETERMINERS.has(word);
}
