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
import { DETERMINERS } from "./words";

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
function nounPhraseVerdict(next: string, matches: string, lead: string): Verdict {
  return DETERMINERS.has(next)
    ? {
        verdict: "fits",
        signals: [lead, "noun_phrase_follows"],
        reason: `${matches}, with a noun phrase after it.`,
      }
    : {
        verdict: "likely_fits",
        signals: [lead, "noun_unchecked"],
        reason: `${matches}; Lexora can't check that ${quote(next)} starts a noun phrase.`,
      };
}

/**
 * What follows the blank, against what the structure says follows. `matches` says which
 * structure matched; `lead` is its evidence code (`pattern`, or `frame_object` for a frame).
 */
function complementVerdict(
  complement: Complement,
  next: string | undefined,
  matches: string,
  lead: string,
): Verdict {
  if (next === undefined) {
    return {
      verdict: "depends",
      signals: [lead, "nothing_follows"],
      reason: `${matches}; it depends on what comes after the gap.`,
    };
  }
  switch (complement) {
    case "person":
      return PERSONS.has(next)
        ? {
            verdict: "fits",
            signals: [lead, "person_follows"],
            reason: `${matches}, with a person after it.`,
          }
        : {
            verdict: "depends",
            signals: [lead, "person_unknown"],
            reason: `${matches} — it depends on whether a person follows.`,
          };
    case "clause":
      return CLAUSE_STARTS.has(next)
        ? {
            verdict: "fits",
            signals: [lead, "clause_follows"],
            reason: `${matches}, with a clause after it.`,
          }
        : {
            verdict: "depends",
            signals: [lead, "clause_unknown"],
            reason: `${matches} — it depends on whether a clause such as “whether …” follows.`,
          };
    case "ing":
      return isIng(next)
        ? {
            verdict: "fits",
            signals: [lead, "ing_follows"],
            reason: `${matches}, with an -ing form after it.`,
          }
        : {
            verdict: "depends",
            signals: [lead, "ing_unknown"],
            reason: `${matches} — it depends on an -ing form following.`,
          };
    case "noun_or_ing":
      return isIng(next)
        ? {
            verdict: "fits",
            signals: [lead, "ing_follows"],
            reason: `${matches}, with an -ing form after it.`,
          }
        : nounPhraseVerdict(next, matches, lead);
    case "noun":
      return nounPhraseVerdict(next, matches, lead);
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
    `Matches the pattern ${quote(candidate.evidence.display)}`,
    "pattern",
  );
}

/**
 * The preposition after a verb frame's object (Step 4.4): a recreated mistake; else an object the
 * frame doesn't author (the frame doesn't cover this sentence); else what follows the blank.
 */
export function framePrepositionVerdict(
  candidate: GapCandidate,
  window: GapWindow,
  mistakes: readonly MistakeHit[],
): Verdict {
  const mistake = recreatedMistake(window, candidate.fill, mistakes);
  if (mistake) return mistakeVerdict(mistake);
  const frame = quote(candidate.evidence.display);
  const object = quote(window.before[0]!);
  if (!candidate.objectAuthored) {
    return {
      verdict: "not_supported",
      signals: ["frame_object_not_authored"],
      reason: `Lexora's frame ${frame} doesn't list ${object} among its objects, so it can't say which preposition follows.`,
    };
  }
  return complementVerdict(
    candidate.complement ?? "noun",
    window.after[0],
    `Matches the frame ${frame} with ${object} as its object`,
    "frame_object",
  );
}

/**
 * A collocation candidate: a recreated mistake; else the learner's words as written (an authored
 * inflection of the first word counts as written) or only through the stemmer. At most Likely
 * fits when a side of the blank the collocation doesn't cover can't be checked: it ends at the
 * blank before a content word it doesn't cover, or starts at the blank after a function word that
 * combines with its first word ("There is ___ a threat").
 */
export function collocationVerdict(
  candidate: GapCandidate,
  window: GapWindow,
  mistakes: readonly MistakeHit[],
): Verdict {
  const mistake = recreatedMistake(window, candidate.fill, mistakes);
  if (mistake) return mistakeVerdict(mistake);
  const collocation = quote(candidate.evidence.display);
  const openSide = candidate.openRight || candidate.openLeft;
  const open = openSide ? ["other_side_unchecked"] : [];
  const unchecked = candidate.openRight
    ? `; Lexora can't check ${quote(window.after[0]!)} after it`
    : candidate.openLeft
      ? `; Lexora can't check ${quote(window.before[0]!)} before it`
      : "";
  if (candidate.inflected) {
    return {
      verdict: "likely_fits",
      signals: ["collocation", "inflected", ...open],
      reason: `Matches the collocation ${collocation} in another form of its words${unchecked}.`,
    };
  }
  const authored = candidate.authoredForm ? ["authored_form"] : [];
  return openSide
    ? {
        verdict: "likely_fits",
        signals: ["collocation", ...authored, ...open],
        reason: `Matches the collocation ${collocation}${unchecked}.`,
      }
    : {
        verdict: "fits",
        signals: ["collocation", ...authored],
        reason: candidate.authoredForm
          ? `Matches the collocation ${collocation}, in a form Lexora's content lists.`
          : `Matches the collocation ${collocation}.`,
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
