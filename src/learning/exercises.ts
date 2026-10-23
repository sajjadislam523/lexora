/**
 * Review exercises generated from authored content (Phase 5, specification §11–13). Pure and
 * deterministic: the same material always gives the same exercises, in the same order, with the
 * same IDs. Nothing is inferred — no synonyms, similarity, fuzzy matching or models. When the
 * authored content doesn't establish an exercise and its answer, the exercise isn't generated.
 *
 * Three types, from three authored structures:
 *
 * - `term` (complete the sentence): an example with the item's own form blanked;
 * - `preposition` (type the preposition): an example linked to a preposition pattern, with the
 *   pattern's preposition blanked;
 * - `mistake` (which is correct?): an authored mistake, its wrong and right versions as options.
 *
 * Each exercise has a client-safe `prompt` and a server-only `key`, the authored answers that
 * `evaluateAnswer` (./answers.ts) checks against. Generating changes nothing: no card, log or
 * schedule.
 */
import type { PracticeBlank } from "@/language/schema/vocabulary";

import { normaliseAnswer } from "./answers";

export const EXERCISE_TYPES = ["term", "preposition", "mistake"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export type { PracticeBlank };

/** Everything the generator reads about one sense: authored rows, as imported. */
export type PracticeMaterial = {
  senseId: string;
  /** The item's kind: preposition-pattern items get no `term` exercise (it would be trivial). */
  itemKind: string;
  /** The item's headword, for display. */
  term: string;
  /** Set when the item has more than one sense. */
  senseLabel?: string;
  definition: string;
  /** Every authored form of the item (lemma, inflections, spelling variants, contractions). */
  forms: string[];
  examples: {
    /** Global ID: `<sense id>:<local id>`. */
    id: string;
    text: string;
    /** Character spans of the authored highlights, in text order. */
    highlights: { start: number; end: number }[];
    /** Global ID of the preposition pattern the example shows, if any. */
    patternId: string | null;
    /** Authored `practice` data: also-correct answers and blanks not to generate. */
    accept: string[];
    acceptPreposition: string[];
    exclude: PracticeBlank[];
  }[];
  patterns: {
    id: string;
    base: string;
    preposition: string;
    /** Display pattern, e.g. `be responsible for + noun / -ing`. */
    pattern: string;
    note: string | null;
    mistakeId: string | null;
  }[];
  mistakes: { id: string; wrong: string; right: string; type: string; explanation: string }[];
};

/** A sentence with one blank: text before it, the blank, text after it. */
export type SentencePart = string | { gap: 0 };

/** What the learner is shown. Never contains the answer. */
export type ExercisePrompt = {
  id: string;
  type: ExerciseType;
  senseId: string;
  term: string;
  senseLabel?: string;
  /** `term` and `preposition`: the authored example with one blank. */
  sentence?: SentencePart[];
  /** `term`: how many words the blank holds. */
  blankWords?: number;
  /** The meaning (`term`), the pattern with its preposition hidden (`preposition`), or the question (`mistake`). */
  cue: string;
  /** `mistake`: the two versions, in this card's order, under opaque IDs. */
  options?: { id: "a" | "b"; text: string }[];
};

/** How an answer is checked: authored values only, normalised with `normaliseAnswer`. */
export type ExerciseKey =
  | {
      kind: "typed";
      /** The answer as written in the sentence, shown in feedback. */
      expected: string;
      /** Other authored forms of the item: correct, with the sentence's form shown. */
      forms: string[];
      /** Authored `practice.accept` / `accept_preposition`: also correct. */
      accepted: string[];
      /** Authored wrong answers: a recognised mistake, with its explanation. */
      mistakes: { answer: string; mistakeId: string }[];
    }
  | {
      kind: "choice";
      expected: string;
      correctOption: "a" | "b";
      wrongOption: "a" | "b";
      mistakeId: string;
    };

export type Exercise = {
  prompt: ExercisePrompt;
  key: ExerciseKey;
  /** The authored structure it comes from: an example or a mistake ID. */
  source: string;
  /** Authored text for feedback: the sense's best-when or the mistake's explanation is added by the caller. */
  explanation?: string;
};

type Token = { start: number; end: number; word: string };

/** The sentence's words with their character positions, normalised as answers are. */
function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      word: normaliseAnswer(match[0]),
    });
  }
  return tokens;
}

const wordsOf = (phrase: string) => tokenise(phrase).map((token) => token.word);

/** Every place the words occur in a row, as token indexes. */
function occurrences(tokens: Token[], words: string[]) {
  const found: number[] = [];
  if (words.length === 0) return found;
  for (let at = 0; at + words.length <= tokens.length; at++) {
    if (words.every((word, offset) => tokens[at + offset]!.word === word)) found.push(at);
  }
  return found;
}

const inside = (span: { start: number; end: number }, start: number, end: number) =>
  span.start <= start && end <= span.end;

/** The sentence with characters `start`–`end` replaced by one blank. */
function blanked(text: string, start: number, end: number): SentencePart[] {
  const parts: SentencePart[] = [];
  if (start > 0) parts.push(text.slice(0, start));
  parts.push({ gap: 0 });
  if (end < text.length) parts.push(text.slice(end));
  return parts;
}

/**
 * The words that differ between an authored mistake and its correction: the wrong part and the
 * right part, after the words they share at the start and end.
 */
export function mistakeDifference(mistake: { wrong: string; right: string }) {
  const wrong = wordsOf(mistake.wrong);
  const right = wordsOf(mistake.right);
  let start = 0;
  while (start < wrong.length && start < right.length && wrong[start] === right[start]) start++;
  let shared = 0;
  while (
    start + shared < wrong.length &&
    start + shared < right.length &&
    wrong[wrong.length - 1 - shared] === right[right.length - 1 - shared]
  ) {
    shared++;
  }
  return {
    wrong: wrong.slice(start, wrong.length - shared).join(" "),
    right: right.slice(start, right.length - shared).join(" "),
  };
}

/** Authored mistakes whose correction is exactly `expected`, as the wrong answers that show them. */
function recognisedMistakes(material: PracticeMaterial, expected: string) {
  const answer = normaliseAnswer(expected);
  return material.mistakes.flatMap((mistake) => {
    const difference = mistakeDifference(mistake);
    return difference.right === answer && difference.wrong
      ? [{ answer: difference.wrong, mistakeId: mistake.id }]
      : [];
  });
}

const unique = (values: string[], without: string) =>
  [...new Set(values.map(normaliseAnswer))].filter((value) => value && value !== without);

/**
 * Complete the sentence (§12.1): the longest authored form of the item found, as whole words in
 * a row, inside a highlight. Skipped for preposition-pattern items, `exclude: [term]`, a form
 * split by another word ("take urgent measures"), a form that occurs twice, or a blank that
 * would be the whole sentence.
 */
function termExercise(
  material: PracticeMaterial,
  example: PracticeMaterial["examples"][number],
): Exercise | null {
  if (material.itemKind === "preposition_pattern" || example.exclude.includes("term")) return null;
  const tokens = tokenise(example.text);
  const forms = [...new Set(material.forms.map(wordsOf).map((words) => words.join(" ")))]
    .filter(Boolean)
    .map((form) => form.split(" "))
    .sort((a, b) => b.length - a.length || b.join(" ").length - a.join(" ").length);

  for (const form of forms) {
    const at = occurrences(tokens, form);
    const inHighlight = at.filter((index) =>
      example.highlights.some((span) =>
        inside(span, tokens[index]!.start, tokens[index + form.length - 1]!.end),
      ),
    );
    if (inHighlight.length === 0) continue;
    if (at.length > 1 || form.length === tokens.length) return null;
    const first = tokens[inHighlight[0]!]!;
    const last = tokens[inHighlight[0]! + form.length - 1]!;
    const expected = example.text.slice(first.start, last.end);
    const answer = normaliseAnswer(expected);
    return {
      prompt: {
        id: `term:${example.id}`,
        type: "term",
        senseId: material.senseId,
        term: material.term,
        ...(material.senseLabel && { senseLabel: material.senseLabel }),
        sentence: blanked(example.text, first.start, last.end),
        blankWords: form.length,
        cue: material.definition,
      },
      key: {
        kind: "typed",
        expected,
        forms: unique(material.forms, answer),
        accepted: unique(example.accept, answer),
        mistakes: recognisedMistakes(material, expected),
      },
      source: example.id,
    };
  }
  return null;
}

/**
 * Type the preposition (§12.2): an example linked to a pattern whose highlight ends with the
 * pattern's preposition, which becomes the blank. Skipped for `exclude: [preposition]`, a
 * highlight that doesn't end with it, or a preposition that occurs twice in the highlight.
 */
function prepositionExercise(
  material: PracticeMaterial,
  example: PracticeMaterial["examples"][number],
): Exercise | null {
  if (!example.patternId || example.exclude.includes("preposition")) return null;
  const pattern = material.patterns.find((p) => p.id === example.patternId);
  if (!pattern) return null;
  const preposition = normaliseAnswer(pattern.preposition);
  if (!preposition || preposition.includes(" ")) return null;
  const tokens = tokenise(example.text);

  for (const span of example.highlights) {
    const within = tokens.filter((token) => inside(span, token.start, token.end));
    const last = within.at(-1);
    if (!last || last.word !== preposition) continue;
    if (within.filter((token) => token.word === preposition).length > 1) return null;
    const cue = pattern.pattern.replace(
      new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegExp(pattern.preposition)}(?=$|[^\\p{L}\\p{N}])`,
        "giu",
      ),
      "$1___",
    );
    return {
      prompt: {
        id: `preposition:${example.id}`,
        type: "preposition",
        senseId: material.senseId,
        term: material.term,
        ...(material.senseLabel && { senseLabel: material.senseLabel }),
        sentence: blanked(example.text, last.start, last.end),
        cue,
      },
      key: {
        kind: "typed",
        expected: example.text.slice(last.start, last.end),
        forms: [],
        accepted: unique(example.acceptPreposition, preposition),
        mistakes: recognisedMistakes(material, pattern.preposition),
      },
      source: example.id,
      ...(pattern.note && { explanation: pattern.note }),
    };
  }
  return null;
}

/**
 * Which is correct? (§12.3): an authored mistake's two versions. Skipped only when they read the
 * same as written (they then can't be told apart). Option order comes from the card, so it varies
 * between reviews without randomness: `(reviews + the mistake's position) mod 2`.
 */
function mistakeExercise(
  material: PracticeMaterial,
  mistake: PracticeMaterial["mistakes"][number],
  position: number,
  reviews: number,
): Exercise | null {
  const right = mistake.right.trim();
  const wrong = mistake.wrong.trim();
  if (!right || !wrong || right === wrong) return null;
  const rightFirst = (reviews + position) % 2 === 0;
  const options: ExercisePrompt["options"] = rightFirst
    ? [
        { id: "a", text: right },
        { id: "b", text: wrong },
      ]
    : [
        { id: "a", text: wrong },
        { id: "b", text: right },
      ];
  return {
    prompt: {
      id: `mistake:${mistake.id}`,
      type: "mistake",
      senseId: material.senseId,
      term: material.term,
      ...(material.senseLabel && { senseLabel: material.senseLabel }),
      cue: "Which is correct?",
      options,
    },
    key: {
      kind: "choice",
      expected: right,
      correctOption: rightFirst ? "a" : "b",
      wrongOption: rightFirst ? "b" : "a",
      mistakeId: mistake.id,
    },
    source: mistake.id,
    explanation: mistake.explanation,
  };
}

/**
 * Every exercise the sense's authored content supports, in review order (§11.3): term,
 * preposition and mistake exercises taken in turn (t1, p1, m1, t2, …), each list in authored
 * order. `reviews` (the card's answers so far) only sets the option order of choice exercises.
 */
export function generateExercises(material: PracticeMaterial, reviews = 0): Exercise[] {
  const lists: Exercise[][] = [
    material.examples.flatMap((example) => termExercise(material, example) ?? []),
    material.examples.flatMap((example) => prepositionExercise(material, example) ?? []),
    material.mistakes.flatMap(
      (mistake, position) => mistakeExercise(material, mistake, position, reviews) ?? [],
    ),
  ];
  const ordered: Exercise[] = [];
  for (let round = 0; lists.some((list) => round < list.length); round++) {
    for (const list of lists) if (round < list.length) ordered.push(list[round]!);
  }
  return ordered;
}

/**
 * The exercise for a card that has had `reviews` answers: the next one in review order, so each
 * review moves to the next exercise and the list starts again at the end. Null when the content
 * supports none.
 */
export function exerciseFor(material: PracticeMaterial, reviews: number): Exercise | null {
  const exercises = generateExercises(material, reviews);
  return exercises.length === 0 ? null : exercises[reviews % exercises.length]!;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
