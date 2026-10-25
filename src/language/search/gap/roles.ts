/**
 * Word classes around a blank (Phase 6B): what kind of word the gap can't take, read from the
 * words next to it. Not a parser: a few closed classes (articles, prepositions, modals, numbers)
 * and what Lexora's own content says its words are (each form's senses' parts of speech), with
 * rules that only exclude. A word Lexora doesn't know rules nothing out.
 *
 * - Before a preposition ("rose ___ in 2020") a gap can't be a preposition.
 * - Right after a verb ("suffer ___ poverty") a gap can't be another verb; and an adverb can't
 *   come between the verb and a noun phrase after the gap ("rose ___ 2020").
 * - After an article or possessive ("a ___ increase") a gap can't be a verb or a preposition.
 * - After a modal ("should ___ more money") a gap can't be a noun or a preposition.
 * - A pattern authored on a noun ("a rise in + noun") doesn't fit the learner's word where the
 *   content only knows that form as a verb ("rose").
 */
import type { PartOfSpeech } from "../../schema/vocabulary";
import type { WordClassHit } from "../repository";

import type { GapCandidate, GapWindow } from "./candidates";
import { GAP_PREPOSITIONS } from "./words";

export type WordClass =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "preposition"
  | "determiner"
  | "pronoun"
  | "modal"
  | "number";

/** What the content says each word can be. */
export type Lexicon = ReadonlyMap<string, ReadonlySet<WordClass>>;

const POS_CLASS: Partial<Record<PartOfSpeech, WordClass>> = {
  noun: "noun",
  noun_phrase: "noun",
  verb: "verb",
  verb_phrase: "verb",
  adjective: "adjective",
  adjective_phrase: "adjective",
  adverb: "adverb",
  adverbial_phrase: "adverb",
  preposition: "preposition",
};

/** Words after which a noun phrase has started: no verb or preposition can follow. */
const ARTICLES = new Set(["a", "an", "the", "my", "your", "his", "its", "our", "their"]);

const MODALS = new Set([
  "can",
  "could",
  "will",
  "would",
  "shall",
  "should",
  "may",
  "might",
  "must",
]);

/** Object pronouns: a noun phrase on their own ("depend on them"). */
const OBJECT_PRONOUNS = new Set(["me", "you", "him", "it", "us", "them"]);

const PRONOUNS = new Set([...OBJECT_PRONOUNS, "i", "he", "she", "we", "they"]);

/** Prepositions only (no word here is also a conjunction, such as "after" or "since"). */
const PREPOSITIONS = new Set<string>([
  ...GAP_PREPOSITIONS,
  "during",
  "over",
  "between",
  "throughout",
  "within",
  "across",
  "among",
  "per",
]);

/** Verbs another verb can follow directly ("help reduce poverty", "let them go"). */
const CHAIN_VERBS = new Set(
  ["help", "let", "make", "go", "come", "see", "hear", "watch", "dare"].flatMap((verb) => [
    verb,
    `${verb}s`,
    `${verb}ed`,
    `${verb}ing`,
  ]),
);

/**
 * The lexicon from the repository's rows. A non-"-s" inflection ("rose", "increased") is only a
 * verb form, never a noun's: nouns inflect for the plural.
 */
export function buildLexicon(hits: readonly WordClassHit[]): Lexicon {
  const lexicon = new Map<string, Set<WordClass>>();
  for (const hit of hits) {
    const wordClass = POS_CLASS[hit.partOfSpeech];
    if (!wordClass) continue;
    if (wordClass === "noun" && hit.formType === "inflection" && !hit.word.endsWith("s")) continue;
    const classes = lexicon.get(hit.word) ?? new Set<WordClass>();
    classes.add(wordClass);
    lexicon.set(hit.word, classes);
  }
  return lexicon;
}

/** A word's classes: closed classes first, then the content's. Empty when unknown. */
export function classesOf(word: string | undefined, lexicon: Lexicon): ReadonlySet<WordClass> {
  if (word === undefined) return new Set();
  if (/^\d/.test(word)) return new Set(["number"]);
  if (ARTICLES.has(word)) return new Set(["determiner"]);
  if (PREPOSITIONS.has(word)) return new Set(["preposition"]);
  if (MODALS.has(word)) return new Set(["modal"]);
  if (PRONOUNS.has(word)) return new Set(["pronoun"]);
  return lexicon.get(word) ?? new Set();
}

/** The word starts a noun phrase: an article, a number, an object pronoun, a known noun or adjective. */
export function startsNounPhrase(word: string | undefined, lexicon: Lexicon) {
  if (word !== undefined && OBJECT_PRONOUNS.has(word)) return true;
  const classes = [...classesOf(word, lexicon)];
  return (
    classes.length > 0 &&
    classes.every((c) => ["determiner", "number", "noun", "adjective"].includes(c))
  );
}

/** Why a kind of word can't go in the blank: the rule, and the learner's word that decides it. */
export type Exclusion = {
  rule: "before_preposition" | "after_verb" | "verb_object" | "after_article" | "after_modal";
  word: string;
};

export type SlotReading = ReadonlyMap<WordClass, Exclusion>;

const onlyVerb = (classes: ReadonlySet<WordClass>) => classes.size === 1 && classes.has("verb");

/** What can't go in the blank, from the words on each side. Unknown words exclude nothing. */
export function readSlot(window: GapWindow, lexicon: Lexicon): SlotReading {
  const excluded = new Map<WordClass, Exclusion>();
  const exclude = (classes: WordClass[], exclusion: Exclusion) => {
    for (const c of classes) if (!excluded.has(c)) excluded.set(c, exclusion);
  };
  const [left, right] = [window.before[0], window.after[0]];
  const leftClasses = classesOf(left, lexicon);

  if (right !== undefined && PREPOSITIONS.has(right)) {
    exclude(["preposition"], { rule: "before_preposition", word: right });
  }
  if (left !== undefined && onlyVerb(leftClasses) && !CHAIN_VERBS.has(left)) {
    exclude(["verb"], { rule: "after_verb", word: left });
    if (startsNounPhrase(right, lexicon)) exclude(["adverb"], { rule: "verb_object", word: left });
  }
  if (left !== undefined && ARTICLES.has(left)) {
    exclude(["verb", "preposition"], { rule: "after_article", word: left });
  }
  if (left !== undefined && MODALS.has(left)) {
    exclude(["noun", "preposition"], { rule: "after_modal", word: left });
  }
  return excluded;
}

/** A candidate the words around the blank rule out, and why. */
export type ClassConflict =
  | { kind: "slot"; exclusion: Exclusion; wordClass: WordClass }
  /** A pattern authored on a noun, where the learner's base word is only known as a verb. */
  | { kind: "noun_pattern"; word: string };

/** The classes of what a candidate puts in the blank; undefined when that isn't checked. */
function fillClasses(
  candidate: GapCandidate,
  lexicon: Lexicon,
): ReadonlySet<WordClass> | undefined {
  if (candidate.type === "preposition" || candidate.type === "frame_preposition") {
    return new Set(["preposition"]);
  }
  if (candidate.type === "collocation") return classesOf(candidate.fill, lexicon);
  return undefined;
}

/**
 * Whether the words around the blank rule a candidate out: every class its word can have is
 * excluded, or (for a preposition pattern authored with an article, "a rise in + noun") the
 * learner's base word is only a verb. Linkers and two-blank structures aren't checked.
 */
export function classConflict(
  candidate: GapCandidate,
  window: GapWindow,
  reading: SlotReading,
  lexicon: Lexicon,
): ClassConflict | undefined {
  const classes = fillClasses(candidate, lexicon);
  if (classes && classes.size > 0 && [...classes].every((c) => reading.has(c))) {
    const wordClass = [...classes][0]!;
    return { kind: "slot", exclusion: reading.get(wordClass)!, wordClass };
  }
  if (candidate.type === "preposition" && /^(?:a|an|the) /i.test(candidate.evidence.display)) {
    const word = window.before[candidate.span - 1];
    if (word !== undefined && onlyVerb(classesOf(word, lexicon)))
      return { kind: "noun_pattern", word };
  }
  return undefined;
}

/** The words a slot reading and conflicts need classes for. */
export function lexiconWords(windows: readonly GapWindow[], candidates: readonly GapCandidate[]) {
  return [
    ...new Set([
      ...windows.flatMap((w) => [w.before[0], w.after[0]]),
      ...candidates.flatMap((c) => (c.type === "collocation" ? [c.fill] : [])),
      ...candidates.flatMap((c) => {
        if (c.type !== "preposition") return [];
        const window = windows.find((w) => w.index === c.gap);
        return window ? [window.before[c.span - 1]] : [];
      }),
    ]),
  ].filter((word): word is string => word !== undefined && !/^\d/.test(word));
}
