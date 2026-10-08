/**
 * Matching an idea to an expression intent ("say something increased a lot" → Describe an
 * increase), and reading a sentence with a gap. Pure functions over normalised text.
 */
import type { FramePart } from "../model";
import { GAP_TOKEN, normaliseTerm } from "../normalise";

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
