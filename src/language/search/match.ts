/**
 * Matching an idea to an expression intent ("say something increased a lot" → Describe an
 * increase), reading a sentence with a gap, and telling whether a query shows a known mistake.
 * Pure functions over normalised text.
 */
import type { FramePart } from "../model";
import { GAP_TOKEN, normaliseTerm, words } from "../normalise";

import { functionIn } from "./classify";
import type { GapFrame, IntentDefinition } from "./repository";
import { contentStems, stem } from "./text";
import type { GapFit } from "./types";

/** At least this share of a trigger's words must appear in the phrase. */
export const TRIGGER_THRESHOLD = 0.6;

export type IntentMatch = { intent: IntentDefinition; via: "trigger" | "function"; score: number };

/**
 * The best intent for a phrase: an exact trigger, else the trigger whose content words are best
 * covered by the phrase (ties: more shared words, then intent ID), else an intent whose function
 * is named in the phrase ("show contrast between …").
 */
export function matchIntent(
  phrase: string,
  intents: readonly IntentDefinition[],
): IntentMatch | undefined {
  const words = new Set(contentStems(phrase));
  let best: { intent: IntentDefinition; score: number; shared: number } | undefined;

  for (const intent of intents) {
    for (const trigger of intent.triggers) {
      if (trigger === phrase) return { intent, via: "trigger", score: 1 };
      const stems = contentStems(trigger);
      if (stems.length === 0) continue;
      const shared = stems.filter((s) => words.has(s)).length;
      const score = shared / stems.length;
      if (
        !best ||
        score > best.score ||
        (score === best.score && shared > best.shared) ||
        (score === best.score && shared === best.shared && intent.id < best.intent.id)
      ) {
        best = { intent, score, shared };
      }
    }
  }
  if (best && best.score >= TRIGGER_THRESHOLD) {
    return { intent: best.intent, via: "trigger", score: best.score };
  }

  const fn = functionIn(phrase);
  const byFunction = fn && intents.find((intent) => intent.function === fn);
  return byFunction ? { intent: byFunction, via: "function", score: 0 } : undefined;
}

/** Words skipped between the gap and the object: "___ more money", "___ a lot of time". */
const SKIP = new Set([
  "a",
  "an",
  "the",
  "more",
  "less",
  "much",
  "many",
  "some",
  "any",
  "enough",
  "extra",
  "additional",
  "further",
  "most",
  "all",
  "their",
  "its",
  "our",
  "his",
  "her",
  "my",
  "your",
  "this",
  "that",
  "these",
  "those",
  "lot",
  "lots",
  "of",
  "large",
  "huge",
  "vast",
  "significant",
  "considerable",
  "public",
  "private",
  "sufficient",
]);

const PREPOSITIONS = new Set([
  "in",
  "into",
  "to",
  "for",
  "on",
  "at",
  "with",
  "from",
  "towards",
  "toward",
  "against",
  "about",
  "by",
]);

export type GapReading = { object?: string; preposition?: string };

/** The object noun after the gap (skipping determiners and quantifiers), and the next preposition. */
export function readGap(normalised: string): GapReading {
  const words = normalised.split(" ");
  const gap = words.indexOf(GAP_TOKEN);
  if (gap < 0) return {};
  let object: string | undefined;
  let index = gap + 1;
  for (; index < words.length; index++) {
    const word = words[index]!;
    if (SKIP.has(word)) continue;
    if (PREPOSITIONS.has(word)) break;
    object = word;
    index++;
    break;
  }
  const preposition = words.slice(index).find((word) => PREPOSITIONS.has(word));
  return { ...(object && { object }), ...(preposition && { preposition }) };
}

/** How well a verb frame fits the reading: object filler and preposition both, one, or neither. */
export function frameFit(frame: GapFrame, reading: GapReading): GapFit {
  const object = reading.object;
  const objectFits =
    object !== undefined && frame.fillers.some((filler) => stem(filler) === stem(object));
  if (!objectFits) return "unlikely";
  if (!reading.preposition || frame.prepositions.includes(reading.preposition)) return "fits";
  return "different_preposition";
}

/**
 * A frame usable for gap search: it has a head word and an object slot with fillers. The
 * literal part right after the object gives the accepted prepositions ("in", also "into").
 */
export function toGapFrame(
  senseId: string,
  display: string,
  parts: readonly FramePart[],
): GapFrame | undefined {
  const head = parts.find((part) => "text" in part && part.head);
  const objectIndex = parts.findIndex((part) => "slot" in part && part.fillers?.length);
  if (!head || !("text" in head) || objectIndex < 0) return undefined;
  const object = parts[objectIndex]!;
  const after = parts[objectIndex + 1];
  return {
    senseId,
    head: normaliseTerm(head.text),
    fillers: "fillers" in object ? (object.fillers ?? []).map(normaliseTerm) : [],
    prepositions:
      after && "text" in after ? [after.text, ...(after.also ?? [])].map(normaliseTerm) : [],
    display,
  };
}

/**
 * Whether a query shows an authored mistake, rather than only sharing words with it. A query
 * equal to the whole wrong form always does. A query found inside a longer wrong form ("depend
 * of" in "Many families depend of one income.") does only when it covers the wrong part: the
 * words left after the start and end the wrong form shares with its correction. So "a
 * significant" doesn't show "a significant amount of people" (the wrong part is "amount"), and a
 * mistake whose wrong form differs only in punctuation is shown only by the whole sentence.
 */
export function showsMistake(normalised: string, mistake: { wrong: string; right: string }) {
  const query = words(normalised);
  const wrong = words(normaliseTerm(mistake.wrong));
  const right = words(normaliseTerm(mistake.right));
  if (query.join(" ") === wrong.join(" ")) return true;

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
  const end = wrong.length - shared;
  // Punctuation only: normalised, the wrong form and its correction are the same words.
  if (start === wrong.length && wrong.length === right.length) return false;
  // The wrong part, or for a missing word ("as result") the two words around the gap.
  const [from, to] =
    start < end ? [start, end - 1] : [Math.max(start - 1, 0), Math.min(start, wrong.length - 1)];

  for (let at = 0; at + query.length <= wrong.length; at++) {
    const here = query.every((word, offset) => wrong[at + offset] === word);
    if (here && at <= from && at + query.length - 1 >= to) return true;
  }
  return false;
}
