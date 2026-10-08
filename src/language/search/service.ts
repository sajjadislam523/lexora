/**
 * LanguageSearchService: deterministic search over published language (docs/ARCHITECTURE.md →
 * Search). No AI, embeddings or learned ranking. Every step is a rule below:
 *
 * 1. Normalise the query.
 * 2. Classify its shape (classify.ts): the first matching pattern wins.
 * 3. Resolve the term: exact form → spelling variant → cautious typo correction, always shown.
 * 4. Retrieve by intent through the repository.
 * 5. Rank with a fixed score tuple (rank.ts).
 * 6. Shape the response: an interpretation line, groups, a fit guide, mistakes, and a reason for
 *    every result.
 */
import type { SenseSummary } from "../model";
import { MAX_QUERY_LENGTH, normaliseQuery, words } from "../normalise";
import { RELATION_GROUPS, RELATION_PHRASE } from "../relations";
import type { DiscourseFunction, RelationType } from "../schema/vocabulary";

import { classify, type Classification } from "./classify";
import { frameFit, matchIntent, readGap } from "./match";
import { RELATION_PRIORITY, rank, type Candidate, type MatchTier } from "./rank";
import type {
  CollocationHit,
  FormMatch,
  GapFrame,
  LanguageSearchRepository,
  MistakeHit,
  PatternHit,
  RelationHit,
  SenseRef,
} from "./repository";
import { chooseCorrection } from "./text";
import {
  resultFrom,
  type FitGuide,
  type GapFit,
  type Modifier,
  type ResultGroup,
  type SearchResponse,
  type SearchResult,
  type TermResolution,
} from "./types";

const SYNONYM_TYPES: RelationType[] = [
  "synonym",
  "stronger",
  "alternative",
  "more_formal",
  "more_natural",
  "weaker",
];

const FUNCTION_LABEL: Record<DiscourseFunction, string> = {
  addition: "adding a point",
  cause: "giving a cause",
  concession: "conceding a point",
  contrast: "contrast",
  emphasis: "emphasis",
  example: "giving examples",
  importance: "importance",
  increase: "describing an increase",
  problem: "describing a problem",
  result: "showing a result",
};

type Resolved = { resolution: TermResolution; forms: FormMatch[] };
type Resolution = Resolved | { didYouMean: string[] } | undefined;

const quote = (text: string) => `“${text}”`;

export class LanguageSearchService {
  constructor(private readonly repo: LanguageSearchRepository) {}

  async search(input: string): Promise<SearchResponse | null> {
    const query = input.trim().slice(0, MAX_QUERY_LENGTH);
    const normalised = normaliseQuery(query);
    if (!normalised) return null;

    const classification = classify(normalised);
    const base = { query, normalised };
    switch (classification.intent) {
      case "SYNONYM":
      case "STRONGER_ALTERNATIVE":
      case "WEAKER_ALTERNATIVE":
      case "ALTERNATIVE":
        return this.relationSearch(base, classification);
      case "PREPOSITION":
        return this.prepositionSearch(base, classification);
      case "COLLOCATION":
        return this.collocationSearch(base, classification);
      case "LINKER":
      case "PHRASE":
      case "SENTENCE_PATTERN":
      case "CONTEXTUAL_EXPRESSION":
        return this.expressionSearch(base, classification);
      case "CONTEXT_GAP":
        return this.gapSearch(base);
      case "LOOKUP":
        return this.lookup(base, normalised, []);
    }
  }

  // ── Term resolution ──────────────────────────────────────────────────────────────────────

  /** Exact form, then spelling variant, then a cautious typo correction (never silent). */
  private async resolve(term: string): Promise<Resolution> {
    const forms = await this.repo.findForms(term);
    if (forms.length > 0) return { forms, resolution: describeMatch(term, forms) };

    const outcome = chooseCorrection(term, await this.repo.findTermCandidates(term));
    if (outcome.kind === "ambiguous") return { didYouMean: outcome.options };
    if (outcome.kind !== "corrected") return undefined;
    const corrected = await this.repo.findForms(outcome.to);
    if (corrected.length === 0) return undefined;
    return {
      forms: corrected,
      resolution: { input: term, resolved: corrected[0]!.headword, via: "typo" },
    };
  }

  private async sensesFor(forms: FormMatch[]) {
    const itemIds = [...new Set(forms.map((form) => form.itemId))];
    return this.repo.sensesOfItems(itemIds);
  }

  // ── Synonyms, stronger, weaker, alternatives ─────────────────────────────────────────────

  private async relationSearch(
    base: { query: string; normalised: string },
    c: Classification,
  ): Promise<SearchResponse> {
    const term = c.term!;
    const resolved = await this.resolve(term);
    if (!resolved) return this.lookup(base, base.normalised, c.modifiers);
    if ("didYouMean" in resolved) return didYouMean(base, c, resolved.didYouMean);

    const types: RelationType[] =
      c.intent === "STRONGER_ALTERNATIVE"
        ? ["stronger"]
        : c.intent === "WEAKER_ALTERNATIVE"
          ? ["weaker"]
          : SYNONYM_TYPES;
    const senses = await this.sensesFor(resolved.forms);
    const relations = await this.repo.relationsFrom(
      senses.map((sense) => sense.id),
      types,
    );
    const summaries = await this.summaries(relations.map((r) => r.toSenseId));
    const headword = resolved.forms[0]!.headword;
    const tier: MatchTier = resolved.resolution.via === "typo" ? 4 : 3;

    // One group per sense of the term that has alternatives ("significant — having a real effect").
    const groups: ResultGroup[] = [];
    const relationByKey = new Map<string, RelationType>();
    for (const sense of senses) {
      const own = relations.filter((relation) => relation.fromSenseId === sense.id);
      const candidates = own.flatMap((relation): Candidate[] => {
        const summary = summaries.get(relation.toSenseId);
        if (!summary) return [];
        relationByKey.set(relation.toSenseId, relation.type);
        return [
          {
            result: resultFrom(summary, relationReason(relation, headword)),
            tier,
            weight: relation.weight,
            relevance: summary.ieltsRelevance,
            typePriority: RELATION_PRIORITY[relation.type] ?? 9,
            position: 0,
          },
        ];
      });
      const results = rank(candidates, c.modifiers, (candidate) =>
        relationByKey.get(candidate.result.key),
      );
      if (results.length === 0) continue;
      groups.push({
        ...(senses.filter((s) => !s.standalone).length > 1 &&
          sense.label && { label: `${headword} — ${sense.label}` }),
        results,
      });
    }

    const notes = new Map(relations.map((r) => [r.toSenseId, r.note]));
    return respond(base, c, {
      summary: `${relationSummary(c.intent, c.modifiers)} ${quote(headword)}`,
      term: resolved.resolution,
      groups,
      guide: guideFrom(groups, (result) => notes.get(result.senseId)),
    });
  }

  // ── Prepositions ─────────────────────────────────────────────────────────────────────────

  private async prepositionSearch(
    base: { query: string; normalised: string },
    c: Classification,
  ): Promise<SearchResponse> {
    const term = c.term!;
    let resolution: TermResolution = { input: term, resolved: term, via: "exact" };
    let patterns = await this.repo.findPatternsByBase(term);

    if (patterns.length === 0) {
      // "preposition after depends": the term is a form of an item that has patterns.
      const forms = await this.repo.findForms(term);
      if (forms.length > 0) {
        patterns = await this.repo.patternsOf((await this.sensesFor(forms)).map((s) => s.id));
        resolution = describeMatch(term, forms);
      }
    }
    if (patterns.length === 0) {
      const outcome = chooseCorrection(term, await this.repo.findPatternBaseCandidates(term));
      if (outcome.kind === "ambiguous") return didYouMean(base, c, outcome.options);
      if (outcome.kind === "corrected") {
        patterns = await this.repo.findPatternsByBase(outcome.to);
        resolution = { input: term, resolved: outcome.to, via: "typo" };
      }
    }
    if (patterns.length === 0) return this.lookup(base, base.normalised, c.modifiers);

    const senseIds = [...new Set(patterns.map((p) => p.senseId))];
    const summaries = await this.summaries(senseIds);
    const candidates = patterns.flatMap((pattern, index): Candidate[] => {
      const summary = summaries.get(pattern.senseId);
      if (!summary) return [];
      return [
        {
          result: patternResult(summary, pattern),
          tier: resolution.via === "typo" ? 4 : 2,
          weight: 0,
          relevance: summary.ieltsRelevance,
          typePriority: 0,
          position: index,
        },
      ];
    });

    const mistakes = (await this.repo.mistakesOf(senseIds)).filter(
      (mistake) =>
        mistake.type === "preposition" || patterns.some((p) => p.mistakeId === mistake.id),
    );
    return respond(base, c, {
      summary: `Prepositions after ${quote(patterns[0]!.base)}`,
      term: resolution,
      groups: [{ results: rank(candidates) }],
      mistakes,
    });
  }

  // ── Collocations ─────────────────────────────────────────────────────────────────────────

  private async collocationSearch(
    base: { query: string; normalised: string },
    c: Classification,
  ): Promise<SearchResponse> {
    const resolved = await this.resolve(c.term!);
    if (!resolved) return this.lookup(base, base.normalised, c.modifiers);
    if ("didYouMean" in resolved) return didYouMean(base, c, resolved.didYouMean);

    const headword = resolved.forms[0]!.headword;
    const senses = (await this.sensesFor(resolved.forms)).filter((s) => !s.standalone);
    const senseIds = senses.map((sense) => sense.id);
    const [rows, partOf] = await Promise.all([
      this.repo.collocationsOf(senseIds),
      this.repo.relationsFrom(senseIds, ["component_of"]),
    ]);
    const summaries = await this.summaries([
      ...senseIds,
      ...rows.flatMap((row) => (row.linkedSenseId ? [row.linkedSenseId] : [])),
      ...partOf.map((relation) => relation.toSenseId),
    ]);

    const groups: ResultGroup[] = [];
    for (const sense of senses) {
      const linked = new Set<string>();
      const candidates = rows
        .filter((row) => row.senseId === sense.id)
        .flatMap((row): Candidate[] => {
          const parent = summaries.get(row.senseId);
          if (!parent) return [];
          if (row.linkedSenseId) linked.add(row.linkedSenseId);
          return [
            {
              result: collocationResult(row, parent, summaries, headword),
              tier: 5,
              weight: 0,
              relevance: parent.ieltsRelevance,
              typePriority: 0,
              position: row.position,
            },
          ];
        });
      for (const relation of partOf.filter((r) => r.fromSenseId === sense.id)) {
        const summary = summaries.get(relation.toSenseId);
        if (!summary || linked.has(summary.senseId)) continue;
        candidates.push({
          result: resultFrom(summary, `A fixed phrase with ${quote(headword)}`),
          tier: 5,
          weight: 0,
          relevance: summary.ieltsRelevance,
          typePriority: 1,
          position: 1_000,
        });
      }
      const results = rank(candidates);
      if (results.length === 0) continue;
      groups.push({
        ...(senses.length > 1 && sense.label && { label: `${headword} — ${sense.label}` }),
        results,
      });
    }

    return respond(base, c, {
      summary: `Collocations with ${quote(headword)}`,
      term: resolved.resolution,
      groups,
    });
  }

  // ── Linkers, phrases, sentence patterns and "I want to …" ────────────────────────────────

  private async expressionSearch(
    base: { query: string; normalised: string },
    c: Classification,
  ): Promise<SearchResponse> {
    const phrase = c.phrase!;
    const intents = await this.repo.listIntents();
    const match =
      c.intent === "LINKER" && c.function
        ? intents.find((intent) => intent.function === c.function)
        : matchIntent(phrase, intents)?.intent;

    if (match) {
      const summaries = await this.summaries(match.entries.map((entry) => entry.senseId));
      const groups: ResultGroup[] = [];
      match.entries.forEach((entry) => {
        const summary = summaries.get(entry.senseId);
        if (!summary) return;
        const result = resultFrom(summary, capitalise(entry.fit));
        const group = groups.find((g) => g.label === entry.group);
        if (group) group.results.push(result);
        else groups.push({ label: entry.group, results: [result] });
      });

      // Linker questions also list other linkers with the function that the intent doesn't.
      if (c.intent === "LINKER" && c.function) {
        const listed = new Set(match.entries.map((entry) => entry.senseId));
        const others = (await this.repo.sensesWithFunction(c.function, ["linker"])).filter(
          (id) => !listed.has(id),
        );
        const extra = await this.summaries(others);
        const results = others.flatMap((id) => {
          const summary = extra.get(id);
          return summary
            ? [resultFrom(summary, `A linker for ${FUNCTION_LABEL[c.function!]}`)]
            : [];
        });
        if (results.length > 0) groups.push({ label: "Other linkers", results });
      }

      if (c.intent === "SENTENCE_PATTERN") moveKindFirst(groups, "sentence_pattern");
      return respond(base, c, {
        summary: `Language to ${match.label.toLowerCase()}`,
        groups,
        guide: {
          title: "Which one fits?",
          rows: match.entries.flatMap((entry) => {
            const summary = summaries.get(entry.senseId);
            return summary ? [{ term: summary.headword, when: entry.fit }] : [];
          }),
        },
      });
    }

    // No intent: language with the function named in the phrase, else an ordinary lookup.
    if (c.function) {
      const ids = await this.repo.sensesWithFunction(c.function);
      const summaries = await this.summaries(ids);
      const results = ids.flatMap((id) => {
        const summary = summaries.get(id);
        return summary ? [resultFrom(summary, `Used for ${FUNCTION_LABEL[c.function!]}`)] : [];
      });
      if (results.length > 0) {
        return respond(base, c, {
          summary: `Language for ${FUNCTION_LABEL[c.function]}`,
          groups: [{ results }],
        });
      }
    }
    return this.lookup(base, base.normalised, c.modifiers);
  }

  // ── Context gap ──────────────────────────────────────────────────────────────────────────

  private async gapSearch(base: { query: string; normalised: string }): Promise<SearchResponse> {
    const c: Classification = { intent: "CONTEXT_GAP", modifiers: [] };
    const reading = readGap(base.normalised);
    if (!reading.object) {
      return respond(base, c, {
        summary: "Find a word for the gap — add the words that come after it",
        groups: [],
        gap: reading,
      });
    }

    const frames = await this.repo.listGapFrames();
    const summaries = await this.summaries(frames.map((frame) => frame.senseId));
    const object = reading.object;
    const preposition = reading.preposition;
    const scored = frames.flatMap((frame) => {
      const summary = summaries.get(frame.senseId);
      if (!summary) return [];
      const fit = frameFit(frame, reading);
      return [{ frame, summary, fit }];
    });

    const fitting = scored.filter((s) => s.fit !== "unlikely");
    const unlikely = scored.filter((s) => s.fit === "unlikely");
    const toResult = ({ frame, summary, fit }: (typeof scored)[number]): SearchResult => {
      // The preposition this verb brings: the learner's own when it fits, else the frame's.
      const takes = fit === "fits" ? preposition : frame.prepositions[0];
      return resultFrom(summary, gapReason(frame, fit, object, preposition), {
        key: `${summary.senseId}:gap`,
        pattern: frame.display,
        fit,
        fill: { word: frame.head, ...(takes && { preposition: takes }) },
      });
    };
    const order = { fits: 0, different_preposition: 1, unlikely: 2 } as const;
    const sorted = (list: typeof scored) =>
      [...list].sort(
        (a, b) =>
          order[a.fit] - order[b.fit] || a.summary.headword.localeCompare(b.summary.headword),
      );

    const groups: ResultGroup[] = [];
    if (fitting.length > 0) {
      groups.push({ label: "Fits this sentence", results: sorted(fitting).map(toResult) });
    }
    // Shown, not hidden, so the learner sees why these verbs don't work here.
    const nearby = unlikely.filter((s) => s.frame.prepositions.length > 0);
    if (fitting.length > 0 && nearby.length > 0) {
      groups.push({ label: "Doesn't fit this sentence", results: sorted(nearby).map(toResult) });
    }

    const context = [object, preposition]
      .filter((word): word is string => Boolean(word))
      .map(quote)
      .join(" and ");
    return respond(base, c, {
      summary: `Verbs for the gap, checked against ${context}`,
      groups,
      gap: reading,
      guide:
        groups.length > 0
          ? {
              title: "Why each verb does or doesn't fit",
              rows: sorted(scored).map(({ frame, fit }) => ({
                term: frame.display,
                when: gapReason(frame, fit, object, preposition),
              })),
            }
          : undefined,
    });
  }

  // ── Lookup ───────────────────────────────────────────────────────────────────────────────

  /**
   * Exact term → exact phrase (collocation, pattern) → stored mistake → typo → a known term
   * inside the query → full text (labelled as a fallback).
   */
  private async lookup(
    base: { query: string; normalised: string },
    text: string,
    modifiers: Modifier[],
  ): Promise<SearchResponse> {
    const c: Classification = { intent: "LOOKUP", term: text, modifiers };

    const forms = await this.repo.findForms(text);
    if (forms.length > 0) return this.itemLookup(base, c, forms, describeMatch(text, forms), 1);

    const phrase = await this.phraseLookup(base, c, text);
    if (phrase) return phrase;

    const mistakes = await this.repo.findMistakes(text);
    if (mistakes.length > 0) return this.mistakeLookup(base, c, mistakes);

    const outcome = chooseCorrection(text, await this.repo.findTermCandidates(text));
    if (outcome.kind === "ambiguous") return didYouMean(base, c, outcome.options);
    if (outcome.kind === "corrected") {
      const corrected = await this.repo.findForms(outcome.to);
      const resolution: TermResolution = {
        input: text,
        resolved: corrected[0]?.headword ?? outcome.to,
        via: "typo",
      };
      if (corrected.length > 0) return this.itemLookup(base, c, corrected, resolution, 4);
      const phraseMatch = await this.phraseLookup(base, c, outcome.to, resolution);
      if (phraseMatch) return phraseMatch;
    }

    const contained = await this.repo.findFormsIn(phrasesIn(text));
    if (contained.length > 0) {
      // The longest known term inside the query: "depend on public transport" → depend on.
      const longest = Math.max(...contained.map((form) => form.form.length));
      const best = contained.filter((form) => form.form.length === longest);
      return this.itemLookup(
        base,
        c,
        best,
        { input: text, resolved: best[0]!.headword, via: "exact" },
        6,
      );
    }

    const ids = await this.repo.fullText(text);
    if (ids.length > 0) {
      const summaries = await this.summaries(ids);
      const results = ids.flatMap((id) => {
        const summary = summaries.get(id);
        return summary
          ? [resultFrom(summary, "Mentions these words in its meaning or examples")]
          : [];
      });
      return respond(base, c, {
        summary: `No exact match for ${quote(base.query)} — showing language that mentions it`,
        groups: [{ results }],
        outcome: "fallback",
      });
    }

    return respond(base, c, { summary: `No match for ${quote(base.query)}`, groups: [] });
  }

  /** A term's item: its senses first, then its related language grouped by relation. */
  private async itemLookup(
    base: { query: string; normalised: string },
    c: Classification,
    forms: FormMatch[],
    resolution: TermResolution,
    tier: MatchTier,
  ): Promise<SearchResponse> {
    const senses = await this.sensesFor(forms);
    const senseIds = senses.map((sense) => sense.id);
    const relations = await this.repo.relationsFrom(
      senseIds,
      RELATION_GROUPS.flatMap((g) => g.types),
    );
    const summaries = await this.summaries([...senseIds, ...relations.map((r) => r.toSenseId)]);
    const headword = forms[0]!.headword;

    const own = senses.flatMap((sense: SenseRef): SearchResult[] => {
      const summary = summaries.get(sense.id);
      return summary ? [resultFrom(summary, lookupReason(resolution, tier))] : [];
    });
    const groups: ResultGroup[] = [{ results: own }];
    for (const { label, types } of RELATION_GROUPS) {
      const candidates = relations
        .filter((relation) => types.includes(relation.type))
        .flatMap((relation): Candidate[] => {
          const summary = summaries.get(relation.toSenseId);
          if (!summary || senseIds.includes(summary.senseId)) return [];
          return [
            {
              result: resultFrom(summary, relationReason(relation, headword)),
              tier: 6,
              weight: relation.weight,
              relevance: summary.ieltsRelevance,
              typePriority: 0,
              position: 0,
            },
          ];
        });
      const results = rank(candidates);
      if (results.length > 0) groups.push({ label, results });
    }

    const notes = new Map(relations.map((r) => [r.toSenseId, r.note]));
    return respond(base, c, {
      summary: groups.some((group) => group.label)
        ? `${quote(headword)} and related language`
        : quote(headword),
      term: resolution,
      groups,
      guide: guideFrom(groups.slice(1), (result) => notes.get(result.senseId), "How they differ"),
    });
  }

  /** An exact collocation ("a significant increase") or pattern base ("responsible"). */
  private async phraseLookup(
    base: { query: string; normalised: string },
    c: Classification,
    text: string,
    resolution?: TermResolution,
  ): Promise<SearchResponse | undefined> {
    const [collocations, patterns] = await Promise.all([
      this.repo.findCollocationsByPhrase(text),
      this.repo.findPatternsByBase(text),
    ]);
    if (collocations.length === 0 && patterns.length === 0) return undefined;

    const summaries = await this.summaries([
      ...collocations.flatMap((row) => [
        row.senseId,
        ...(row.linkedSenseId ? [row.linkedSenseId] : []),
      ]),
      ...patterns.map((row) => row.senseId),
    ]);
    const results: SearchResult[] = [];
    for (const row of collocations) {
      const parent = summaries.get(row.senseId);
      if (parent) results.push(collocationResult(row, parent, summaries, parent.headword));
    }
    for (const row of patterns) {
      const summary = summaries.get(row.senseId);
      if (summary) results.push(patternResult(summary, row));
    }
    const mistakes = patterns.length
      ? (await this.repo.mistakesOf(patterns.map((p) => p.senseId))).filter((m) =>
          patterns.some((p) => p.mistakeId === m.id),
        )
      : [];
    return respond(base, c, {
      summary: `${quote(resolution?.resolved ?? text)} in Lexora`,
      ...(resolution && { term: resolution }),
      groups: [{ results }],
      mistakes,
    });
  }

  /** "responsible of": the correct language, with the mistake explained — never a silent fix. */
  private async mistakeLookup(
    base: { query: string; normalised: string },
    c: Classification,
    mistakes: MistakeHit[],
  ): Promise<SearchResponse> {
    const summaries = await this.summaries(mistakes.map((m) => m.senseId));
    const results = mistakes.flatMap((mistake) => {
      const summary = summaries.get(mistake.senseId);
      return summary
        ? [
            resultFrom(
              summary,
              `A common mistake: ${quote(mistake.wrong)} → ${quote(mistake.right)}`,
            ),
          ]
        : [];
    });
    return respond(base, c, {
      summary: `${quote(base.query)} is a common mistake — here is the correct form`,
      groups: [{ results: dedupe(results) }],
      mistakes,
    });
  }

  private async summaries(ids: readonly string[]) {
    const unique = [...new Set(ids)];
    const list = await this.repo.getSenseSummaries(unique);
    return new Map(list.map((summary) => [summary.senseId, summary]));
  }
}

// ── Response shaping ───────────────────────────────────────────────────────────────────────

function respond(
  base: { query: string; normalised: string },
  c: Classification,
  parts: {
    summary: string;
    term?: TermResolution;
    groups: ResultGroup[];
    guide?: FitGuide;
    mistakes?: MistakeHit[];
    outcome?: SearchResponse["outcome"];
    gap?: SearchResponse["gap"];
  },
): SearchResponse {
  const groups = parts.groups.filter((group) => group.results.length > 0);
  const mistakes = dedupeBy(parts.mistakes ?? [], (m) => m.id).map(
    ({ wrong, right, explanation }) => ({
      wrong,
      right,
      explanation,
    }),
  );
  return {
    query: base.query,
    normalised: base.normalised,
    interpretation: {
      intent: c.intent,
      summary: parts.summary,
      ...(parts.term && { term: parts.term }),
      modifiers: c.modifiers,
    },
    groups,
    ...(parts.guide && parts.guide.rows.length > 0 && { guide: parts.guide }),
    mistakes,
    ...(parts.gap && { gap: parts.gap }),
    outcome: groups.length === 0 ? "none" : (parts.outcome ?? "results"),
  };
}

function didYouMean(
  base: { query: string; normalised: string },
  c: Classification,
  options: string[],
): SearchResponse {
  return {
    ...respond(base, c, {
      summary: `Did you mean ${options.map(quote).join(" or ")}?`,
      groups: [],
    }),
    didYouMean: options,
  };
}

function describeMatch(term: string, forms: FormMatch[]): TermResolution {
  const form = forms[0]!;
  if (form.formType === "spelling_variant") {
    const note =
      form.region === "us"
        ? `${term} is the US spelling; Lexora shows the British spelling, ${form.headword}. Both are correct.`
        : `${term} is another spelling of ${form.headword}. Both are correct.`;
    return {
      input: term,
      resolved: form.headword,
      via: "variant",
      note,
      ...(form.region && { region: form.region }),
    };
  }
  return { input: term, resolved: form.headword, via: "exact" };
}

/** Short on purpose: the interpretation (`term.note`) carries the full explanation. */
function lookupReason(resolution: TermResolution, tier: MatchTier) {
  if (resolution.via === "variant") {
    const spelling = resolution.region === "us" ? "the US spelling" : "another spelling";
    return `Matches ${quote(resolution.input)}, ${spelling}`;
  }
  if (resolution.via === "typo") return `Closest spelling to ${quote(resolution.input)}`;
  return tier === 6 ? `Contains ${quote(resolution.resolved)}` : "Exact match";
}

function relationReason(relation: RelationHit, headword: string) {
  const phrase = `${RELATION_PHRASE[relation.type]} ${headword}`;
  return relation.note ? `${phrase} · ${relation.note}` : phrase;
}

function relationSummary(intent: Classification["intent"], modifiers: Modifier[]) {
  if (intent === "STRONGER_ALTERNATIVE") return "Stronger alternatives to";
  if (intent === "WEAKER_ALTERNATIVE") return "Weaker alternatives to";
  const style = [
    modifiers.includes("natural") ? "Natural" : undefined,
    modifiers.includes("informal") ? "Informal" : undefined,
    modifiers.includes("formal") ? "Formal" : undefined,
    modifiers.includes("academic") ? "Academic" : undefined,
    modifiers.includes("speaking") ? "spoken" : undefined,
    modifiers.includes("writing") ? "written" : undefined,
  ].filter(Boolean);
  return style.length > 0 ? `${capitalise(style.join(" "))} alternatives to` : "Alternatives to";
}

function guideFrom(
  groups: ResultGroup[],
  noteOf: (result: SearchResult) => string | undefined,
  title = "Which one fits?",
): FitGuide | undefined {
  const rows = groups
    .flatMap((group) => group.results)
    .flatMap((result) => {
      const note = noteOf(result);
      return note ? [{ term: result.term, when: note }] : [];
    });
  return rows.length > 0 ? { title, rows: dedupeBy(rows, (row) => row.term) } : undefined;
}

function patternResult(summary: SenseSummary, pattern: PatternHit): SearchResult {
  const note = pattern.note ? ` — ${pattern.note}` : "";
  return resultFrom(summary, `${quote(pattern.preposition)} after ${pattern.base}${note}`, {
    key: pattern.id,
    term: `${pattern.base} ${pattern.preposition}`,
    pattern: pattern.pattern,
  });
}

function collocationResult(
  row: CollocationHit,
  parent: SenseSummary,
  summaries: Map<string, SenseSummary>,
  headword: string,
): SearchResult {
  const linked = row.linkedSenseId ? summaries.get(row.linkedSenseId) : undefined;
  const owner = linked ?? parent;
  return resultFrom(
    owner,
    `A collocation with ${quote(headword)}${row.note ? ` — ${row.note}` : ""}`,
    {
      key: row.id,
      term: row.phrase,
      ...(row.pattern && { pattern: row.pattern }),
      ...(row.example && { example: row.example }),
      ...(!linked && row.note && { definition: capitalise(row.note) }),
    },
  );
}

function gapReason(frame: GapFrame, fit: GapFit, object: string, preposition: string | undefined) {
  const takes = frame.prepositions.map(quote).join(" or ");
  if (fit === "fits") {
    return preposition
      ? `Fits: ${frame.head} + ${object} + ${preposition}`
      : `Fits: ${frame.head} takes ${object}`;
  }
  if (fit === "different_preposition") {
    return `Takes ${quote(object)}, but with ${takes}, not ${quote(preposition ?? "")}`;
  }
  return `Usually takes ${frame.fillers.slice(0, 3).join(", ")} — not ${object}`;
}

function moveKindFirst(groups: ResultGroup[], kind: SearchResult["kind"]) {
  groups.sort(
    (a, b) =>
      Number(!a.results.some((r) => r.kind === kind)) -
      Number(!b.results.some((r) => r.kind === kind)),
  );
}

/** Every run of 1–5 consecutive words: candidates for a known term inside a longer query. */
function phrasesIn(text: string) {
  const list = words(text);
  const phrases: string[] = [];
  for (let size = Math.min(5, list.length); size >= 1; size--) {
    for (let start = 0; start + size <= list.length; start++) {
      const phrase = list.slice(start, start + size).join(" ");
      if (phrase.length >= 4) phrases.push(phrase);
    }
  }
  return phrases;
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dedupe(results: SearchResult[]) {
  return dedupeBy(results, (result) => result.key);
}

function dedupeBy<T>(list: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return list.filter((value) => {
    const k = key(value);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
