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

const PREPOSITION_SET = new Set<string>(GAP_PREPOSITIONS);

/** A stopword, a preposition or a determiner: a word that can't anchor or be checked as content. */
export function isFunctionWord(word: string) {
  return STOPWORDS.has(word) || PREPOSITION_SET.has(word) || DETERMINERS.has(word);
}
