/**
 * Context-fit verdicts (Phase 4 Step 4.3, docs/specs/phase-4-step-4-context-gaps.md §8): how well
 * a candidate fits the words around its blank, from authored evidence only. Categorical, never a
 * score; every verdict names the evidence it rests on. This is language fit for one blank, not a
 * grammar check of the sentence.
 *
 * Precedence, the same for every kind of candidate:
 *
 * 1. Unlikely — contradicting evidence: the filled-in words recreate one of the candidate sense's
 *    authored mistakes (or, for verb frames, the frame takes another preposition).
 * 2. Not supported — the candidate's authored structure doesn't cover this context (a verb frame
 *    whose authored objects don't include the learner's).
 * 3. Fits — every part Lexora can check agrees.
 * 4. Likely fits — the structure matches, and the one part left can't be checked with the data.
 * 5. Depends — the structure matches, but what decides the fit isn't in the sentence or can't be
 *    read from it (nothing after the gap; a person or clause that can't be recognised; which
 *    relationship a linker should express).
 */
import { normaliseTerm } from "../../normalise";
import type { Complement } from "../../schema/vocabulary";
import { mistakeWrongPart } from "../match";
import type { MistakeHit } from "../repository";
import type { GapFit } from "../types";

import type { GapCandidate, GapWindow } from "./candidates";

export const GAP_VERDICTS = [
  "fits",
  "likely_fits",
  "depends",
  "unlikely",
  "not_supported",
] as const;
export type GapVerdict = (typeof GAP_VERDICTS)[number];

/** The order candidates are listed in, within a blank and kind. */
export const VERDICT_ORDER: Record<GapVerdict, number> = {
  fits: 0,
  likely_fits: 1,
  depends: 2,
  unlikely: 3,
  not_supported: 4,
};

/** A verdict, the evidence behind it (stable codes), and its reason in words. */
export type Verdict = {
  verdict: GapVerdict;
  signals: string[];
  reason: string;
  mistake?: MistakeHit;
};

/** Words that start a noun phrase: what follows them is a noun phrase. */
const DETERMINERS = new Set([
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

/** Pronouns that name a person (a closed class: the only persons Lexora can recognise). */
const PERSONS = new Set([
  "me",
  "you",
  "him",
  "her",
  "us",
  "them",
  "someone",
  "somebody",
  "anyone",
  "anybody",
  "everyone",
  "everybody",
  "nobody",
  "others",
]);

/** Words that start a clause after a preposition ("depends on whether …"). */
const CLAUSE_STARTS = new Set([
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "when",
  "where",
  "why",
  "how",
  "whether",
  "if",
]);

const quote = (text: string) => `“${text}”`;
const isIng = (word: string) => word.length > 4 && word.endsWith("ing");

/**
 * The authored mistake of this sense, if any, that filling the blank with the candidate recreates:
 * the learner's words, with the candidate in the blank, contain the mistake's wrong words and the
 * authored word next to them on each side where the mistake has one ("important **for** me" needs
 * "important" and "me"; "**make** awareness" needs only "awareness"), with the candidate inside
 * the wrong words. So "important for young people" doesn't recreate "important for me".
 */
export function recreatedMistake(
  window: GapWindow,
  fill: string,
  mistakes: readonly MistakeHit[],
): MistakeHit | undefined {
  const filled = [
    ...[...window.before].reverse(),
    ...normaliseTerm(fill).split(" "),
    ...window.after,
  ];
  const blank = window.before.length;
  return mistakes.find((mistake) => {
    const { wrong, span, missing } = mistakeWrongPart(mistake);
    if (!span || missing) return false;
    const [from, to] = span;
    const lo = Math.max(from - 1, 0);
    const hi = Math.min(to + 1, wrong.length - 1);
    const needed = wrong.slice(lo, hi + 1);
    for (let at = 0; at + needed.length <= filled.length; at++) {
      const inWrongPart = blank >= at + (from - lo) && blank <= at + (to - lo);
      if (inWrongPart && needed.every((word, offset) => filled[at + offset] === word)) return true;
    }
    return false;
  });
}

function mistakeVerdict(mistake: MistakeHit): Verdict {
  return {
    verdict: "unlikely",
    signals: ["authored_mistake"],
    reason: `This would make ${quote(mistake.wrong)} — ${mistake.explanation}`,
    mistake,
  };
}

/** A noun complement: a determiner shows a noun phrase follows; any other word can't be checked. */
function nounPhraseVerdict(next: string, matches: string): Verdict {
  return DETERMINERS.has(next)
    ? {
        verdict: "fits",
        signals: ["pattern", "noun_phrase_follows"],
        reason: `${matches}, with a noun phrase after it.`,
      }
    : {
        verdict: "likely_fits",
        signals: ["pattern", "noun_unchecked"],
        reason: `${matches}; Lexora can't check that ${quote(next)} starts a noun phrase.`,
      };
}

/** What follows the blank, against what the pattern says follows. */
function complementVerdict(
  complement: Complement,
  next: string | undefined,
  structure: string,
): Verdict {
  const matches = `Matches the pattern ${quote(structure)}`;
  if (next === undefined) {
    return {
      verdict: "depends",
      signals: ["pattern", "nothing_follows"],
      reason: `${matches}; it depends on what comes after the gap.`,
    };
  }
  switch (complement) {
    case "person":
      return PERSONS.has(next)
        ? {
            verdict: "fits",
            signals: ["pattern", "person_follows"],
            reason: `${matches}, with a person after it.`,
          }
        : {
            verdict: "depends",
            signals: ["pattern", "person_unknown"],
            reason: `${matches} — it depends on whether a person follows.`,
          };
    case "clause":
      return CLAUSE_STARTS.has(next)
        ? {
            verdict: "fits",
            signals: ["pattern", "clause_follows"],
            reason: `${matches}, with a clause after it.`,
          }
        : {
            verdict: "depends",
            signals: ["pattern", "clause_unknown"],
            reason: `${matches} — it depends on whether a clause such as “whether …” follows.`,
          };
    case "ing":
      return isIng(next)
        ? {
            verdict: "fits",
            signals: ["pattern", "ing_follows"],
            reason: `${matches}, with an -ing form after it.`,
          }
        : {
            verdict: "depends",
            signals: ["pattern", "ing_unknown"],
            reason: `${matches} — it depends on an -ing form following.`,
          };
    case "noun_or_ing":
      return isIng(next)
        ? {
            verdict: "fits",
            signals: ["pattern", "ing_follows"],
            reason: `${matches}, with an -ing form after it.`,
          }
        : nounPhraseVerdict(next, matches);
    case "noun":
      return nounPhraseVerdict(next, matches);
  }
}

/** A preposition candidate: a recreated mistake, else what follows the blank. */
export function prepositionVerdict(
  candidate: GapCandidate,
  window: GapWindow,
  mistakes: readonly MistakeHit[],
): Verdict {
  const mistake = recreatedMistake(window, candidate.fill, mistakes);
  if (mistake) return mistakeVerdict(mistake);
  return complementVerdict(
    candidate.complement ?? "noun",
    window.after[0],
    candidate.evidence.display,
  );
}

/** A collocation candidate: a recreated mistake, else the words as written or only inflected. */
export function collocationVerdict(
  candidate: GapCandidate,
  window: GapWindow,
  mistakes: readonly MistakeHit[],
): Verdict {
  const mistake = recreatedMistake(window, candidate.fill, mistakes);
  if (mistake) return mistakeVerdict(mistake);
  return candidate.inflected
    ? {
        verdict: "likely_fits",
        signals: ["collocation", "inflected"],
        reason: `Matches the collocation ${quote(candidate.evidence.display)} in another form of its words.`,
      }
    : {
        verdict: "fits",
        signals: ["collocation"],
        reason: `Matches the collocation ${quote(candidate.evidence.display)}.`,
      };
}

/**
 * A linker candidate: its authored position matches the learner's punctuation, but which
 * relationship (contrast, addition…) the sentence needs is meaning Lexora doesn't read.
 */
export function linkerVerdict(
  slot: "start" | "between_commas" | "after_comma",
  functionLabel: string | undefined,
): Verdict {
  const where =
    slot === "start"
      ? "at the start of a sentence"
      : slot === "between_commas"
        ? "between commas"
        : "after a comma, joining two clauses";
  return {
    verdict: "depends",
    signals: ["linker_position", `position:${slot}`],
    reason: `${functionLabel ? `A linker for ${functionLabel}` : "A linker"} that goes ${where}; whether it fits depends on how the two ideas relate.`,
  };
}

/** A verb-frame result's verdict, from its protected Phase 3 fit (reasons stay as they were). */
export function frameVerdict(
  fit: GapFit,
  prepositionRead: boolean,
): Pick<Verdict, "verdict" | "signals"> {
  switch (fit) {
    case "fits":
      return prepositionRead
        ? { verdict: "fits", signals: ["frame_object", "frame_preposition"] }
        : { verdict: "likely_fits", signals: ["frame_object", "no_preposition"] };
    case "different_preposition":
      return { verdict: "unlikely", signals: ["frame_object", "frame_other_preposition"] };
    case "unlikely":
      return { verdict: "not_supported", signals: ["frame_object_not_authored"] };
  }
}
