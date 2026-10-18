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
 *
 * Step 4.4 (docs/specs/phase-4-step-4-context-coverage.md) widens what the same evidence reaches:
 * inflected multiword bases through their authored forms ("poses a threat"), the preposition
 * after a verb frame's object ("allocated money ___"), collocations anchored by any of their
 * content words ("___ a threat"), first words the content authors as one another's inflections
 * ("took" / "take"), and guards that never offer the learner's own neighbouring word.
 */
import type { Complement, DiscourseFunction, IeltsRelevance } from "../../schema/vocabulary";
import { SKIP } from "../match";
import type {
  CollocationTemplate,
  GapFrame,
  GapPatternHit,
  ItemFormHit,
  LinkerHit,
  PatternHit,
} from "../repository";
import { STOPWORDS, stem } from "../text";

import type { Blank } from "./reader";
import { GAP_PREPOSITIONS, isFunctionWord } from "./words";

/** Words read on each side of a blank. */
export const WINDOW = 4;

/** At most this many candidates per blank and type. */
export const MAX_CANDIDATES = 20;

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

/** `frame_preposition`: the preposition after a verb frame's object (shown as a preposition). */
export type GapCandidateType = "preposition" | "frame_preposition" | "collocation" | "linker";

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
  /** Prepositions: what the authored pattern says follows ("noun_or_ing", "person"…). */
  complement?: Complement;
  /** Collocations: a learner's word matched only through the stemmer, not as written. */
  inflected?: boolean;
  /** Collocations: a learner's first word matched as an authored inflection ("took" / "take"). */
  authoredForm?: boolean;
  /**
   * Collocations: the collocation ends with the blank and the learner's next word is a content
   * word it doesn't cover, so that side is unchecked.
   */
  openRight?: boolean;
  /** Frame prepositions: the learner's verb and object before the blank ("allocated money"). */
  context?: string;
  /** Frame prepositions: whether the learner's object is one of the frame's authored objects. */
  objectAuthored?: boolean;
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

/**
 * The item forms looked up for a blank: "depends on" (a base before the blank followed by any
 * preposition); the bare base runs, "poses a threat" (Step 4.4); and the words a verb frame's
 * head can be, "allocated" in "allocated money ___" (Step 4.4).
 */
export function formCandidates(window: GapWindow) {
  const bases = baseCandidates(window);
  return [
    ...bases.flatMap((base) => GAP_PREPOSITIONS.map((p) => `${base} ${p}`)),
    ...bases,
    ...headCandidates(window),
  ];
}

/** Words that could be a verb frame's head before its object: `before[1…3]`. */
export function headCandidates(window: GapWindow) {
  return window.before.slice(1, HEAD_REACH + 1);
}

/** How far before the blank a frame's head can be: the object, and up to two skip words. */
const HEAD_REACH = 3;

/** The two runs of words are the same except for their first word ("poses a threat" / "pose a threat"). */
export function differsInFirstWordOnly(a: string, b: string) {
  const [x, y] = [a.split(" "), b.split(" ")];
  return x.length === y.length && x.slice(1).every((word, i) => word === y[i + 1]);
}

/** The pattern puts its preposition directly after its base ("responsible for"), not after an object. */
export function prepositionFollowsBase(pattern: PatternHit) {
  const display = ` ${pattern.pattern
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")} `;
  return display.includes(` ${pattern.base.toLowerCase()} ${pattern.preposition.toLowerCase()} `);
}

/**
 * The words before the blank that a form reached: "focused" through "focused on", or the bare
 * form itself, "poses a threat", when it is the pattern's base with only its first word inflected.
 */
function formBase(
  viaForm: string | undefined,
  pattern: PatternHit,
  bases: Set<string>,
): string | undefined {
  if (!viaForm) return undefined;
  if (viaForm.endsWith(` ${pattern.preposition}`)) {
    const base = viaForm.slice(0, -pattern.preposition.length - 1);
    if (bases.has(base)) return base;
  }
  return bases.has(viaForm) && differsInFirstWordOnly(viaForm, pattern.base.toLowerCase())
    ? viaForm
    : undefined;
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
    const base = bases.has(exact) ? exact : formBase(viaForm, pattern, bases);
    if (!base) continue;
    const existing = found.get(pattern.id);
    if (existing && existing.span >= base.split(" ").length) continue;
    found.set(pattern.id, {
      gap: window.index,
      type: "preposition",
      senseId: pattern.senseId,
      fill: pattern.preposition,
      term: `${pattern.base} ${pattern.preposition}`,
      complement: pattern.complement,
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

// ── Prepositions after a verb frame's object (Step 4.4) ─────────────────────────────────────

/** Where the frame's head is before the blank: `before[1…3]`, with only skip words after it. */
function headPosition(window: GapWindow, head: string, viaForm: string | undefined) {
  for (let at = 1; at <= HEAD_REACH && at < window.before.length; at++) {
    const word = window.before[at]!;
    if (word === head || word === viaForm) return at;
    if (!SKIP.has(word)) return undefined;
  }
  return undefined;
}

/** The frame object's place: the word right before the blank, a content word, not a skip word. */
function frameObject(window: GapWindow) {
  const object = window.before[0];
  return object === undefined || SKIP.has(object) || isFunctionWord(object) ? undefined : object;
}

/**
 * Whether an object pattern's base (or an authored form of it) stands before the blank with an
 * object after it: only then are the verb frames worth reading.
 */
export function reachesFrameHead(window: GapWindow, rows: readonly GapPatternHit[]) {
  return (
    frameObject(window) !== undefined &&
    rows.some(
      ({ pattern, viaForm }) =>
        !prepositionFollowsBase(pattern) &&
        headPosition(window, pattern.base.toLowerCase(), viaForm) !== undefined,
    )
  );
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The preposition after a verb frame's object: "allocated money ___ education". An object
 * pattern (`allocate + noun + to`) reached by its base or an authored form of it ("allocated")
 * leads to its sense's verb frame; the word right before the blank is the object, with only skip
 * words ("more", "her") between it and the head. The frame's prepositions, in authored order,
 * are the candidates; whether the object is one the frame authors is kept for the verdict.
 */
export function framePrepositionCandidates(
  window: GapWindow,
  rows: readonly GapPatternHit[],
  frames: readonly GapFrame[],
): GapCandidate[] {
  const object = frameObject(window);
  if (object === undefined) return [];
  const objectPatterns = rows
    .map((row) => row.pattern)
    .filter((pattern) => !prepositionFollowsBase(pattern));
  const reached = new Map<string, { frame: GapFrame; at: number }>();
  for (const { pattern, viaForm } of rows) {
    if (prepositionFollowsBase(pattern)) continue;
    const head = pattern.base.toLowerCase();
    for (const frame of frames) {
      if (frame.senseId !== pattern.senseId || frame.head !== head) continue;
      const at = headPosition(window, head, viaForm);
      if (at === undefined) continue;
      const existing = reached.get(frame.id);
      if (!existing || at < existing.at) reached.set(frame.id, { frame, at });
    }
  }
  return [...reached.values()]
    .sort((a, b) => byId(a.frame, b.frame))
    .flatMap(({ frame, at }) =>
      frame.prepositions.flatMap((preposition): GapCandidate[] => {
        const own = objectPatterns
          .filter((p) => p.senseId === frame.senseId && p.preposition.toLowerCase() === preposition)
          .sort(byId)[0];
        const complement = own?.complement ?? frame.next;
        if (!complement) return [];
        return [
          {
            gap: window.index,
            type: "frame_preposition",
            senseId: frame.senseId,
            fill: preposition,
            term: `${frame.head} … ${preposition}`,
            complement,
            evidence: {
              id: frame.id,
              display: frame.display,
              ...(own?.mistakeId && { mistakeId: own.mistakeId }),
            },
            span: at + 1,
            context: window.before
              .slice(0, at + 1)
              .reverse()
              .join(" "),
            objectAuthored: frame.fillers.some((filler) => stem(filler) === stem(object)),
          },
        ];
      }),
    );
}

// ── Collocations ─────────────────────────────────────────────────────────────────────────────

/** Whether two words are first words the content authors as one another's inflections. */
export type InflectionFamilies = (a: string, b: string) => boolean;

export const NO_FAMILIES: InflectionFamilies = () => false;

/**
 * Which first words the content authors as inflections of one another (Step 4.4): two forms of
 * one item with the same words after their first ("take measures", "took measures") make their
 * first words one family; a single-word item's forms are one family. A family with a function
 * word in it ("in contrast" / "by contrast") isn't an inflection and is ignored.
 */
export function inflectionFamilies(forms: readonly ItemFormHit[]): InflectionFamilies {
  const groups = new Map<string, Set<string>>();
  for (const form of forms) {
    const words = form.normalized.split(" ");
    const key = `${form.itemId}|${words.length}|${words.slice(1).join(" ")}`;
    const group = groups.get(key) ?? new Set<string>();
    group.add(words[0]!);
    groups.set(key, group);
  }
  const families = [...groups.values()].filter(
    (family) => family.size > 1 && ![...family].some(isFunctionWord),
  );
  return (a, b) => a !== b && families.some((family) => family.has(a) && family.has(b));
}

/** How a collocation word lines up with the learner's: as written, as an authored inflection, by stem. */
function lineUp(word: string, learner: string, first: boolean, families: InflectionFamilies) {
  if (word === learner) return "exact";
  if (first && families(word, learner)) return "authored";
  if (stem(word) === stem(learner)) return "stem";
  return undefined;
}

/** The content words around the blank: a collocation must contain one to be considered. */
export function anchorWords(window: GapWindow) {
  return [...new Set([...window.before, ...window.after].filter((w) => !isFunctionWord(w)))];
}

/** The learner's own word next to the blank, or an inflection of it: never offered (Step 4.4). */
function repeatsNeighbour(fill: string, window: GapWindow, families: InflectionFamilies) {
  return [window.before[0], window.after[0]].some(
    (word) =>
      word !== undefined && (word === fill || stem(word) === stem(fill) || families(word, fill)),
  );
}

/**
 * Collocations that line up with the words around the blank, one of their words in the blank.
 * Every other word of the collocation must match the learner's (as written, as an authored
 * inflection of its first word, or through the stemmer), and at least one of them must be a
 * content word. The word in the blank is never a stopword, never the learner's own word next to
 * the blank, and from an inflected item form only a word of the item's base form.
 */
export function collocationCandidates(
  window: GapWindow,
  templates: readonly CollocationTemplate[],
  families: InflectionFamilies = NO_FAMILIES,
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
    const base = template.base?.split(" ");
    for (let k = 0; k < words.length; k++) {
      const fill = words[k]!;
      if (STOPWORDS.has(fill)) continue;
      // An inflected form ("takes measures") offers only words of the item's base form.
      if (isForm && (base?.length !== words.length || base[k] !== fill)) continue;
      const left = words.slice(0, k).reverse();
      const right = words.slice(k + 1);
      if (left.length > window.before.length || right.length > window.after.length) continue;
      const matches = [
        ...left.map((word, i) => lineUp(word, window.before[i]!, i === k - 1, families)),
        ...right.map((word, i) => lineUp(word, window.after[i]!, false, families)),
      ];
      if (matches.includes(undefined)) continue;
      if (![...left, ...right].some((word) => !isFunctionWord(word))) continue;
      if (repeatsNeighbour(fill, window, families)) continue;
      const inflected = matches.includes("stem");
      const authoredForm = matches.includes("authored");
      const next = window.after[0];
      const openRight = right.length === 0 && next !== undefined && !isFunctionWord(next);
      const key = `${template.senseId}|${fill}`;
      const existing = found.get(key);
      // The longest collocation wins, then one matched as written over one matched through an
      // authored inflection, over one matched only through the stemmer, then the smaller id —
      // whatever order the rows came in.
      const rank = (span: number, match: GapCandidate, id: string) =>
        [-span, match.inflected ? 2 : match.authoredForm ? 1 : 0, id] as const;
      if (existing) {
        const [a, b] = [
          rank(existing.span, existing, existing.evidence.id),
          rank(words.length - 1, { inflected, authoredForm } as GapCandidate, template.id),
        ];
        const keepExisting =
          a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] <= b[2];
        if (keepExisting) continue;
      }
      found.set(key, {
        gap: window.index,
        type: "collocation",
        senseId: template.senseId,
        fill,
        term: template.display,
        evidence: { id: template.id, display: template.display },
        span: words.length - 1,
        ...(inflected && { inflected }),
        ...(authoredForm && { authoredForm }),
        ...(openRight && { openRight }),
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
