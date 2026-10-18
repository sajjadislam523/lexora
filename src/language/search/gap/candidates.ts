/**
 * Context-gap candidates (Phase 4 Step 4.2, docs/specs/phase-4-step-4-context-gaps.md §4, §7):
 * which authored structures could fill a blank, read from the words around it. Pure functions
 * over normalised words and rows the repository already returned. No verdicts (Step 4.3), no
 * scores, no combinations across blanks.
 *
 * - Preposition: the words before the blank end with a preposition pattern's base, and the
 *   pattern puts its preposition straight after that base ("be responsible for + noun").
 * - Collocation: an authored collocation (or a collocation item's form) lines up with the words
 *   around the blank, with exactly one of its words in the blank and a content word next to it.
 *   Collocations don't record word roles, so the match never says "adjective" or "verb".
 * - Linker: the blank starts a sentence before a comma, or sits after a comma; linkers whose
 *   authored position and `connects` allow it.
 */
import type { DiscourseFunction, IeltsRelevance } from "../../schema/vocabulary";
import type { CollocationTemplate, GapPatternHit, LinkerHit, PatternHit } from "../repository";
import { STOPWORDS, stem } from "../text";

import type { Blank } from "./reader";

/** Words read on each side of a blank. */
export const WINDOW = 4;

/** At most this many candidates per blank and type. */
export const MAX_CANDIDATES = 20;

/** The prepositions a pattern can put after its base (a closed class). */
const PREPOSITIONS = [
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

/** What the reader saw around one blank. `before[0]` is the word right before it. */
export type GapWindow = {
  index: 0 | 1;
  before: string[];
  after: string[];
  /** The blank starts the query or a sentence (after `.`, `?` or `!`). */
  atStart: boolean;
  commaBefore: boolean;
  commaAfter: boolean;
  /** Some words follow the blank (a linker needs something to link to). */
  wordsAfter: boolean;
};

export type GapCandidateType = "preposition" | "collocation" | "linker";

/** A structure that could fill a blank, and the authored evidence for it. */
export type GapCandidate = {
  gap: 0 | 1;
  type: GapCandidateType;
  senseId: string;
  /** The word(s) for the blank. */
  fill: string;
  /** What the card shows: the pattern's words, the collocation, or the linker. */
  term: string;
  /** The authored structure: a preposition pattern, collocation, collocation form or linker. */
  evidence: { id: string; display: string; mistakeId?: string };
  /** How many of the learner's words the structure covers (more is more specific). */
  span: number;
};

const GAP = "___";

/**
 * The window around each blank, from the normalised query (where blanks are `___` tokens) and the
 * raw query (for the punctuation the normaliser drops). A window stops at the other blank.
 */
export function gapWindows(normalised: string, query: string, blanks: Blank[]): GapWindow[] {
  const words = normalised.split(" ");
  const positions = words.flatMap((word, at) => (word === GAP ? [at] : []));
  return blanks.slice(0, 2).flatMap((blank, index): GapWindow[] => {
    const at = positions[index];
    if (at === undefined) return [];
    const before: string[] = [];
    for (let i = at - 1; i >= 0 && before.length < WINDOW && words[i] !== GAP; i--) {
      before.push(words[i]!);
    }
    const after: string[] = [];
    for (let i = at + 1; i < words.length && after.length < WINDOW && words[i] !== GAP; i++) {
      after.push(words[i]!);
    }
    const left = query.slice(0, blank.start).trimEnd();
    const right = query.slice(blank.end).trimStart();
    const atStart = left === "" || /[.?!]$/.test(left);
    const commaBefore = left.endsWith(",");
    // Punctuation next to the blank ends the words a pattern or collocation can use there.
    const stopsBefore = atStart || /[,;:]$/.test(left);
    const stopsAfter = /^[,;:.?!]/.test(right);
    return [
      {
        index: index as 0 | 1,
        before: stopsBefore ? [] : before,
        after: stopsAfter ? [] : after,
        atStart,
        commaBefore,
        commaAfter: right.startsWith(","),
        wordsAfter: after.length > 0,
      },
    ];
  });
}

// ── Prepositions ─────────────────────────────────────────────────────────────────────────────

/** "depends", "focused on": every run of words ending right before the blank, nearest first. */
export function baseCandidates(window: GapWindow) {
  const bases: string[] = [];
  for (let size = 1; size <= window.before.length; size++) {
    bases.push(window.before.slice(0, size).reverse().join(" "));
  }
  return bases;
}

/** Forms like "depends on": a base before the blank followed by any preposition. */
export function formCandidates(window: GapWindow) {
  return baseCandidates(window).flatMap((base) => PREPOSITIONS.map((p) => `${base} ${p}`));
}

/** The pattern puts its preposition directly after its base ("responsible for"), not after an object. */
function prepositionFollowsBase(pattern: PatternHit) {
  const display = ` ${pattern.pattern
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")} `;
  return display.includes(` ${pattern.base.toLowerCase()} ${pattern.preposition.toLowerCase()} `);
}

/** The words before the blank that a form like "focused on" matched ("focused"), if any. */
function formBase(viaForm: string | undefined, preposition: string, bases: Set<string>) {
  if (!viaForm?.endsWith(` ${preposition}`)) return undefined;
  const base = viaForm.slice(0, -preposition.length - 1);
  return bases.has(base) ? base : undefined;
}

/**
 * Patterns that could fill the blank: their base ends the words before it (directly, or through
 * an inflected form of a pattern item such as "depends on"), and their preposition follows the
 * base directly. Each pattern keeps its own sense.
 */
export function prepositionCandidates(
  window: GapWindow,
  rows: readonly GapPatternHit[],
): GapCandidate[] {
  const bases = new Set(baseCandidates(window));
  const found = new Map<string, GapCandidate>();
  for (const { pattern, viaForm } of rows) {
    if (!prepositionFollowsBase(pattern)) continue;
    const exact = pattern.base.toLowerCase();
    const base = bases.has(exact) ? exact : formBase(viaForm, pattern.preposition, bases);
    if (!base) continue;
    const existing = found.get(pattern.id);
    if (existing && existing.span >= base.split(" ").length) continue;
    found.set(pattern.id, {
      gap: window.index,
      type: "preposition",
      senseId: pattern.senseId,
      fill: pattern.preposition,
      term: `${pattern.base} ${pattern.preposition}`,
      evidence: {
        id: pattern.id,
        display: pattern.pattern,
        ...(pattern.mistakeId && { mistakeId: pattern.mistakeId }),
      },
      span: base.split(" ").length,
    });
  }
  return [...found.values()];
}

// ── Collocations ─────────────────────────────────────────────────────────────────────────────

const sameWord = (a: string, b: string) => a === b || stem(a) === stem(b);
const isContent = (word: string | undefined) => word !== undefined && !STOPWORDS.has(word);

/** The content words next to the blank: what a collocation must contain to be considered. */
export function anchorWords(window: GapWindow) {
  return [window.before[0], window.after[0]].filter(isContent) as string[];
}

/**
 * Collocations that line up with the words around the blank, one of their words in the blank.
 * Every other word of the collocation must match the learner's (an inflection counts), and a
 * content word must sit right next to the blank. The word in the blank is never a stopword.
 */
export function collocationCandidates(
  window: GapWindow,
  templates: readonly CollocationTemplate[],
): GapCandidate[] {
  // A collocation authored as a full item ("play a crucial role" under crucial) is that item's
  // own form: the item answers it, as on result cards.
  const itemForms = new Set(
    templates.filter((t) => t.id.startsWith("form:")).map((t) => `${t.itemId}|${t.normalized}`),
  );
  const found = new Map<string, GapCandidate>();
  for (const template of templates) {
    const isForm = template.id.startsWith("form:");
    if (!isForm && itemForms.has(`${template.itemId}|${template.normalized}`)) continue;
    const words = template.normalized.split(" ");
    if (words.length < 2) continue;
    for (let k = 0; k < words.length; k++) {
      const fill = words[k]!;
      if (STOPWORDS.has(fill)) continue;
      const left = words.slice(0, k).reverse();
      const right = words.slice(k + 1);
      if (left.length > window.before.length || right.length > window.after.length) continue;
      if (!left.every((word, i) => sameWord(word, window.before[i]!))) continue;
      if (!right.every((word, i) => sameWord(word, window.after[i]!))) continue;
      if (!isContent(left[0]) && !isContent(right[0])) continue;
      const key = `${template.senseId}|${fill}`;
      const existing = found.get(key);
      // The longest collocation wins; a tie goes to the smaller id, whatever order rows came in.
      if (
        existing &&
        (existing.span > words.length - 1 ||
          (existing.span === words.length - 1 && existing.evidence.id <= template.id))
      ) {
        continue;
      }
      found.set(key, {
        gap: window.index,
        type: "collocation",
        senseId: template.senseId,
        fill,
        term: template.display,
        evidence: { id: template.id, display: template.display },
        span: words.length - 1,
      });
    }
  }
  return [...found.values()];
}

// ── Linkers ──────────────────────────────────────────────────────────────────────────────────

/**
 * Where a linker would go, from the learner's punctuation: starting a sentence before a comma,
 * between commas, or after a comma joining a clause. Anything else isn't a linker position.
 */
export function linkerSlot(
  window: GapWindow,
): "start" | "between_commas" | "after_comma" | undefined {
  if (!window.wordsAfter) return undefined;
  if (window.atStart && window.commaAfter) return "start";
  if (window.commaBefore && window.commaAfter) return "between_commas";
  if (window.commaBefore) return "after_comma";
  return undefined;
}

export function linkerCandidates(window: GapWindow, linkers: readonly LinkerHit[]): GapCandidate[] {
  const slot = linkerSlot(window);
  if (!slot) return [];
  return linkers
    .filter((linker) =>
      slot === "start"
        ? linker.positions.includes("start") && linker.connects !== "clauses"
        : slot === "between_commas"
          ? linker.positions.includes("middle") && linker.connects !== "clauses"
          : linker.positions.includes("middle") && linker.connects !== "sentences",
    )
    .map((linker) => ({
      gap: window.index,
      type: "linker" as const,
      senseId: linker.senseId,
      fill: linker.headword,
      term: linker.headword,
      evidence: { id: linker.senseId, display: linker.headword },
      span: 0,
    }));
}

// ── Order ────────────────────────────────────────────────────────────────────────────────────

const RELEVANCE: Record<IeltsRelevance, number> = { core: 0, high: 1, useful: 2 };

/** What ordering needs to know about a candidate's sense. */
export type CandidateFacts = {
  relevance: IeltsRelevance;
  /** Compared by code point, lower case. */
  headword: string;
  /** Linkers only: the first discourse function, for grouping them by function. */
  firstFunction?: DiscourseFunction;
};

/**
 * The fixed order of candidates for one blank and type: the most specific structure (covering
 * more of the learner's words) first, then IELTS relevance, the headword by code point, and the
 * authored evidence id. Linkers come grouped by their first discourse function, in vocabulary
 * order. No scores.
 */
export function orderCandidates(
  candidates: GapCandidate[],
  facts: (senseId: string) => CandidateFacts | undefined,
  functionOrder: readonly DiscourseFunction[],
) {
  const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const rank = (fn: DiscourseFunction | undefined) =>
    fn === undefined ? functionOrder.length : functionOrder.indexOf(fn);
  return candidates
    .flatMap((candidate) => {
      const f = facts(candidate.senseId);
      return f ? [{ candidate, f }] : [];
    })
    .sort(
      (a, b) =>
        rank(a.f.firstFunction) - rank(b.f.firstFunction) ||
        b.candidate.span - a.candidate.span ||
        RELEVANCE[a.f.relevance] - RELEVANCE[b.f.relevance] ||
        byCode(a.f.headword, b.f.headword) ||
        byCode(a.candidate.evidence.id, b.candidate.evidence.id),
    )
    .slice(0, MAX_CANDIDATES)
    .map(({ candidate }) => candidate);
}
