/**
 * The gap reader (Phase 4 Step 4.1, docs/specs/phase-4-step-4-context-gaps.md §4, §11, §12):
 * decides, from the raw query and before anything is searched, whether a query asks for a word
 * in a gap or is an ordinary search that happens to contain dots. Pure string work over at most
 * MAX_QUERY_LENGTH characters: no parsing, no database, no scores.
 *
 * - Underscores (2+) always mark a blank. When a query has any, every ellipsis is punctuation.
 * - Without underscores, an ellipsis (`…`, 3+ dots) is a blank only between words: a letter or
 *   digit is the nearest non-space character on both sides. "however..." is not a gap.
 * - A query with blanks but no words, or with more than two blanks, is an ordinary search on the
 *   text without its markers.
 */
import { GAP_MARKERS } from "../../normalise";

/** Step 4 reads at most this many blanks; more are not interpreted (CG-D4). */
export const MAX_GAPS = 2;

export type GapMarker = "underscore" | "ellipsis";

/** A blank in the raw query: which marker, and where (character offsets). */
export type Blank = { marker: GapMarker; start: number; end: number };

export type GapPlan =
  /** Search as usual. `text` is the query with any markers removed. */
  | { kind: "ordinary"; text: string; note?: "too_many_gaps" }
  /**
   * A gap query. `text` keeps the blanks and drops markers that are punctuation; `withoutBlanks`
   * is the ordinary search to fall back on.
   */
  | { kind: "gap"; text: string; blanks: Blank[]; withoutBlanks: string };

const WORD = /[\p{L}\p{N}]/u;

function markersIn(query: string): Blank[] {
  const pattern = new RegExp(GAP_MARKERS.source, "g");
  const found: Blank[] = [];
  for (let match = pattern.exec(query); match; match = pattern.exec(query)) {
    const marker: GapMarker = match[0].startsWith("_") ? "underscore" : "ellipsis";
    found.push({ marker, start: match.index, end: match.index + match[0].length });
  }
  return found;
}

/** The nearest non-space character before `start` and after `end`, both letters or digits. */
function betweenWords(query: string, { start, end }: Blank) {
  const before = query.slice(0, start).trimEnd().at(-1);
  const after = query.slice(end).trimStart()[0];
  return before !== undefined && after !== undefined && WORD.test(before) && WORD.test(after);
}

/** The query with these markers replaced by a space (so words on either side stay apart). */
function without(query: string, markers: Blank[]) {
  let text = query;
  for (const { start, end } of [...markers].reverse()) {
    text = `${text.slice(0, start)} ${text.slice(end)}`;
  }
  return text;
}

export function planGaps(query: string): GapPlan {
  const markers = markersIn(query);
  if (markers.length === 0) return { kind: "ordinary", text: query };

  const underscores = markers.filter((m) => m.marker === "underscore");
  const blanks =
    underscores.length > 0
      ? underscores
      : markers.filter((m) => m.marker === "ellipsis" && betweenWords(query, m));
  const withoutMarkers = without(query, markers);

  if (blanks.length === 0) return { kind: "ordinary", text: withoutMarkers };
  // Nothing but blanks: no context to read.
  if (!WORD.test(withoutMarkers)) return { kind: "ordinary", text: withoutMarkers };
  if (blanks.length > MAX_GAPS) {
    return { kind: "ordinary", text: withoutMarkers, note: "too_many_gaps" };
  }

  const punctuation = markers.filter((m) => !blanks.includes(m));
  return { kind: "gap", text: without(query, punctuation), blanks, withoutBlanks: withoutMarkers };
}
