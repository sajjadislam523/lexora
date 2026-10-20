/**
 * How the context tool presents the engine's context-gap answer (Phase 4 Step 4.6): headings,
 * the sentence's slots and fills, and each group's scope. Presentation only — which candidates
 * there are, their verdicts, reasons, pairs and order all come from the search engine, and
 * nothing here re-derives them. Where the blanks are comes from the engine's own gap reader.
 */
import type { GapPart } from "@/components/lexora/gap-sentence";
import { planGaps } from "@/language/search/gap/reader";
import type { ResultGroup, SearchResponse, SearchResult } from "@/language/search/types";

/** A result that fills both blanks as one authored structure (Step 4.5). */
export const isPair = (result: SearchResult) => Boolean(result.gapMatch?.gaps);

/** The protected Phase 3 answer: verbs for one blank, each bringing its own preposition. */
export function isVerbFrameAnswer(response: SearchResponse) {
  const results = response.groups.flatMap((group) => group.results);
  return (
    results.length > 0 &&
    results.every((result) => result.gapMatch?.type === "verb_frame" && !isPair(result))
  );
}

/** How the sentence is laid out: its text around each blank, or the Phase 3 verb + preposition. */
export type SentenceLayout = { parts: GapPart[]; blanks: number; frame: boolean };

/**
 * Splits the learner's sentence around its blanks, as the engine's gap reader found them. For the
 * Phase 3 verb-frame answer to a one-blank sentence, also around the preposition the engine read
 * after the object, so each verb can fill both: "Governments should [invest] more money [into] …".
 */
export function sentenceLayout(sentence: string, response: SearchResponse): SentenceLayout {
  const plan = planGaps(sentence);
  const blanks = plan.kind === "gap" ? plan.blanks : [];
  if (blanks.length === 0) return { parts: [sentence], blanks: 0, frame: false };

  const preposition = response.gap?.preposition;
  if (blanks.length === 1 && preposition && isVerbFrameAnswer(response)) {
    const blank = blanks[0]!;
    const before = sentence.slice(0, blank.start);
    const after = sentence.slice(blank.end);
    const escaped = preposition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const word = new RegExp(`\\b${escaped}\\b`, "i").exec(after);
    if (word) {
      return {
        parts: [
          before,
          { gap: 0 },
          after.slice(0, word.index),
          { gap: 1 },
          after.slice(word.index + word[0].length),
        ],
        blanks: 1,
        frame: true,
      };
    }
  }

  const parts: GapPart[] = [];
  let from = 0;
  blanks.forEach((blank, index) => {
    parts.push(sentence.slice(from, blank.start), { gap: index });
    from = blank.end;
  });
  parts.push(sentence.slice(from));
  return { parts, blanks: blanks.length, frame: false };
}

/**
 * What a chosen result puts in the sentence: a pair fills both blanks; a Phase 3 verb fills the
 * blank and the preposition slot; any other result fills only its own blank.
 */
export function sentenceFills(
  result: SearchResult | undefined,
  layout: SentenceLayout,
): (string | undefined)[] {
  if (!result) return [];
  const word = result.fill?.word ?? result.term;
  if (isPair(result) || layout.frame) return [word, result.fill?.preposition];
  const fills: (string | undefined)[] = [];
  fills[result.gapMatch?.gap ?? 0] = word;
  return fills;
}

/** Which blank a group answers, when the sentence has two: both, the first or the second. */
export function groupScope(group: ResultGroup, blanks: number): string | undefined {
  if (blanks < 2) return undefined;
  const first = group.results[0];
  if (!first) return undefined;
  return isPair(first) ? "Both gaps" : `Gap ${(first.gapMatch?.gap ?? 0) + 1}`;
}

/** A group of Phase 3 verb-frame answers for one blank (not pairs). */
const isVerbFrameGroup = (group: ResultGroup) =>
  group.results.length > 0 &&
  group.results.every((result) => result.gapMatch?.type === "verb_frame" && !isPair(result));

/**
 * Each group's heading, in order: the engine's label, led by its scope in a two-blank sentence
 * when the label doesn't already say it ("Gap 1 · Prepositions after “responsible”").
 *
 * The Phase 3 verb-frame groups keep the engine's label only when every answer in them fits
 * ("Fits this sentence" over _Fits_ rows). Otherwise the label would contradict a row's verdict —
 * "Fits this sentence" over an _Unlikely_ verb — so the tool says what the group is instead:
 * "Verbs for this gap", then "Other verbs Lexora checked". The engine's labels are unchanged.
 */
export function groupHeadings(groups: readonly ResultGroup[], blanks: number) {
  let verbGroups = 0;
  return groups.map((group) => {
    let label = group.label ?? "Language for the gap";
    if (isVerbFrameGroup(group)) {
      const allFit = group.results.every((result) => result.gapMatch?.verdict === "fits");
      if (!allFit) label = verbGroups === 0 ? "Verbs for this gap" : "Other verbs Lexora checked";
      verbGroups++;
    }
    const scope = groupScope(group, blanks);
    return scope && !label.startsWith(scope) ? `${scope} · ${label}` : label;
  });
}

/** The tool's title and lead, from what the engine answered. */
export function toolHeading(response: SearchResponse, layout: SentenceLayout) {
  if (layout.blanks < 2 && isVerbFrameAnswer(response)) {
    return {
      title: "Which verb fits this sentence?",
      lead: "Each choice changes the meaning — and brings its own preposition.",
    };
  }
  if (layout.blanks >= 2) {
    return {
      title: "What fits these gaps?",
      lead: "Language from Lexora’s library for each gap, and how well it fits your sentence.",
    };
  }
  return {
    title: "What fits this gap?",
    lead: "Language from Lexora’s library for the words around the gap, and how well it fits your sentence.",
  };
}
