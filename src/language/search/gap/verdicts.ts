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
import { startsNounPhrase, type ClassConflict, type Lexicon, type WordClass } from "./roles";
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

/**
 * What the content and the closed word classes know about the words around a blank (Phase 6B):
 * the lexicon, and a class conflict the service found for this candidate.
 */
export type ClassEvidence = { lexicon?: Lexicon; conflict?: ClassConflict };

/**
 * A noun complement: a determiner shows a noun phrase follows, as does (Phase 6B) a number or a
 * word the content only knows as a noun or adjective; any other word can't be checked.
 */
function nounPhraseVerdict(
  next: string,
  matches: string,
  lead: string,
  lexicon: Lexicon | undefined,
): Verdict {
  return DETERMINERS.has(next) || (lexicon !== undefined && startsNounPhrase(next, lexicon))
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
  lexicon?: Lexicon,
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
        : nounPhraseVerdict(next, matches, lead, lexicon);
    case "noun":
      return nounPhraseVerdict(next, matches, lead, lexicon);
  }
}

const CLASS_NAME: Record<WordClass, string> = {
  noun: "A noun",
  verb: "A verb",
  adjective: "An adjective",
  adverb: "An adverb",
  preposition: "A preposition",
  determiner: "A determiner",
  pronoun: "A pronoun",
  modal: "A modal verb",
  number: "A number",
};

/**
 * Phase 6B: the words around the blank rule the candidate out (gap/roles.ts). Unlikely, with the
 * learner's word that decides it; an authored mistake still comes first.
 */
export function classVerdict(conflict: ClassConflict, display: string): Verdict {
  if (conflict.kind === "noun_pattern") {
    return {
      verdict: "unlikely",
      signals: ["word_class", "noun_pattern"],
      reason: `${quote(display)} uses its word as a noun, but ${quote(conflict.word)} here is a verb.`,
    };
  }
  const { rule, word } = conflict.exclusion;
  const name = CLASS_NAME[conflict.wordClass];
  const reason =
    rule === "before_preposition"
      ? `${name} can't come straight before ${quote(word)}: the gap needs another kind of word.`
      : rule === "verb_object"
        ? `${name} can't go between ${quote(word)} and the noun phrase after the gap.`
        : `${name} can't come straight after ${quote(word)}.`;
  return { verdict: "unlikely", signals: ["word_class", rule], reason };
}

/**
 * A preposition candidate: a recreated mistake; else (Phase 6B) a word class the words around
 * the blank rule out; else what follows the blank.
 */
export function prepositionVerdict(
  candidate: GapCandidate,
  window: GapWindow,
  mistakes: readonly MistakeHit[],
  evidence: ClassEvidence = {},
): Verdict {
  const mistake = recreatedMistake(window, candidate.fill, mistakes);
  if (mistake) return mistakeVerdict(mistake);
  if (evidence.conflict) return classVerdict(evidence.conflict, candidate.evidence.display);
  return complementVerdict(
    candidate.complement ?? "noun",
    window.after[0],
    `Matches the pattern ${quote(candidate.evidence.display)}`,
    "pattern",
    evidence.lexicon,
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
  evidence: ClassEvidence = {},
): Verdict {
  const mistake = recreatedMistake(window, candidate.fill, mistakes);
  if (mistake) return mistakeVerdict(mistake);
  if (evidence.conflict) return classVerdict(evidence.conflict, candidate.evidence.display);
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
    evidence.lexicon,
  );
}

/**
 * One structure filling both blanks (Step 4.5): one shared verdict, by the same precedence. A
 * mistake recreated with both blanks filled; else what follows the second blank, against what the
 * structure says follows; and at most Likely fits when the word before the first blank is a
 * function word or a form of "be"/"have" (that side is unchecked). Only authored objects make a
 * frame pair, so a pair is never Not supported.
 */
export function jointVerdict(
  candidate: GapCandidate,
  first: GapWindow,
  second: GapWindow,
  between: readonly string[],
  mistakes: readonly MistakeHit[],
  lexicon?: Lexicon,
): Verdict {
  const preposition = candidate.preposition!;
  const mistake =
    recreatedMistake(
      { ...first, after: [...between, preposition, ...second.after] },
      candidate.fill,
      mistakes,
    ) ??
    recreatedMistake(
      { ...second, before: [...[...between].reverse(), candidate.fill, ...first.before] },
      preposition,
      mistakes,
    );
  if (mistake) return mistakeVerdict(mistake);
  const structure = quote(candidate.evidence.display);
  const judged =
    candidate.structure === "frame"
      ? complementVerdict(
          candidate.complement ?? "noun",
          second.after[0],
          `Matches the frame ${structure} with ${quote(between.at(-1)!)} as its object`,
          "frame_object",
          lexicon,
        )
      : complementVerdict(
          candidate.complement ?? "noun",
          second.after[0],
          `Matches the pattern ${structure}`,
          "pattern",
          lexicon,
        );
  const verdict: Verdict = { ...judged, signals: ["joint", ...judged.signals] };
  if (!candidate.openLeft) return verdict;
  const unchecked = `Lexora can't check ${quote(first.before[0]!)} before the first gap`;
  return {
    verdict: verdict.verdict === "fits" ? "likely_fits" : verdict.verdict,
    signals: [...verdict.signals, "other_side_unchecked"],
    reason: `${verdict.reason.replace(/\.$/, "")}; ${unchecked}.`,
  };
}

/**
 * A collocation candidate: a recreated mistake; else the learner's words as written (an authored
 * inflection of the first word counts as written) or only through the stemmer. At most Likely
 * fits when a side the collocation doesn't cover can't be checked: a content word after it, or a
 * function word or a form of "be"/"have" before it when it starts at the blank; and when its only
 * evidence is function words ("it is ___ that", Step 4.5).
 */
export function collocationVerdict(
  candidate: GapCandidate,
  window: GapWindow,
  mistakes: readonly MistakeHit[],
): Verdict {
  const mistake = recreatedMistake(window, candidate.fill, mistakes);
  if (mistake) return mistakeVerdict(mistake);
  const collocation = quote(candidate.evidence.display);
  const openSide = candidate.openRight || candidate.openLeft || Boolean(candidate.continuation);
  const open = [
    ...(candidate.openRight || candidate.openLeft ? ["other_side_unchecked"] : []),
    ...(candidate.continuation ? ["continuation_differs"] : []),
  ];
  const functionWords = candidate.functionWordsOnly ? ["function_words_only"] : [];
  const unchecked = [
    candidate.openRight
      ? `; Lexora can't check ${quote(candidate.rightWord ?? window.after[0]!)} after it`
      : candidate.openLeft
        ? `; Lexora can't check ${quote(window.before[0]!)} before it`
        : "",
    candidate.continuation
      ? `; Lexora’s pattern continues it with ${quote(candidate.continuation)}, not ${quote(candidate.rightWord!)}`
      : "",
  ].join("");
  const onlyFunctionWords = candidate.functionWordsOnly
    ? "; only small function words around the gap match it, so Lexora can't confirm the sentence uses it this way"
    : "";
  if (candidate.inflected) {
    return {
      verdict: "likely_fits",
      signals: ["collocation", "inflected", ...open, ...functionWords],
      reason: `Matches the collocation ${collocation} in another form of its words${unchecked}${onlyFunctionWords}.`,
    };
  }
  const authored = candidate.authoredForm ? ["authored_form"] : [];
  return openSide || candidate.functionWordsOnly
    ? {
        verdict: "likely_fits",
        signals: ["collocation", ...authored, ...open, ...functionWords],
        reason: `Matches the collocation ${collocation}${unchecked}${onlyFunctionWords}.`,
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
 * relationship (contrast, addition…) the sentence needs is meaning Lexora doesn't read. Phase 6B:
 * a contrast linker notes authored opposites on the two sides ("rose" … "fell"), still Depends.
 */
export function linkerVerdict(
  slot: "start" | "between_commas" | "after_comma",
  functionLabel: string | undefined,
  opposites?: { left: string; right: string },
): Verdict {
  const where =
    slot === "start"
      ? "at the start of a sentence"
      : slot === "between_commas"
        ? "between commas"
        : "after a comma, joining two clauses";
  const hint = opposites
    ? ` ${quote(opposites.left)} and ${quote(opposites.right)} are opposites, which suggests contrast;`
    : "";
  return {
    verdict: "depends",
    signals: ["linker_position", `position:${slot}`, ...(opposites ? ["opposites"] : [])],
    reason: `${functionLabel ? `A linker for ${functionLabel}` : "A linker"} that goes ${where};${hint} whether it fits depends on how the two ideas relate.`,
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
