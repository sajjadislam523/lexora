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
 * 7. With filters (Phase 4), keep only the results whose sense matches them. Filters never change
 *    how a query is read or ranked: the answer is the same, with fewer results.
 *
 * Phase 6B (docs/ARCHITECTURE.md → Retrieval intelligence) adds, still without AI: request
 * normalisation before step 2 (request.ts), descriptor words read with a term (descriptors.ts),
 * word-class checks for context gaps (gap/roles.ts), word-class and register fit in relation
 * ranking, context-aware choice among the known terms in a longer query, and task-aware order.
 *
 * Browsing (filters without a query) lists matching senses in a fixed order, filtered in the
 * repository, page by page.
 */
import {
  BROWSE_PAGE_SIZE,
  hasFilters,
  matchesFilters,
  searchFiltersSchema,
  type SearchFilters,
} from "../filters";
import type { SenseSummary } from "../model";
import { MAX_QUERY_LENGTH, normaliseQuery, normaliseTerm, words } from "../normalise";
import { RELATION_GROUPS, RELATION_PHRASE } from "../relations";
import {
  DISCOURSE_FUNCTIONS,
  type DiscourseFunction,
  type IeltsTask,
  type PartOfSpeech,
  type RelationType,
} from "../schema/vocabulary";

import { type Classification } from "./classify";
import {
  containsPhrase,
  describesNear,
  glossRank,
  phraseShape,
  readDescriptor,
  signalRank,
  signalsOf,
  type Descriptor,
} from "./descriptors";
import {
  anchorWords,
  baseCandidates,
  collocationCandidates,
  formCandidates,
  framePrepositionCandidates,
  gapWindows,
  headCandidates,
  inflectionFamilies,
  jointCandidates,
  linkerCandidates,
  linkerSlot,
  orderCandidates,
  prepositionCandidates,
  reachesFrameHead,
  wordsBetween,
  type CandidateFacts,
  type GapCandidate,
  type GapCandidateType,
  type GapWindow,
} from "./gap/candidates";
import { planGaps, type Blank, type GapPlan } from "./gap/reader";
import { GAP_PREPOSITIONS, isFunctionWord } from "./gap/words";
import { buildLexicon, classConflict, lexiconWords, readSlot, type Lexicon } from "./gap/roles";
import {
  collocationVerdict,
  framePrepositionVerdict,
  frameVerdict,
  jointVerdict,
  linkerVerdict,
  prepositionVerdict,
  VERDICT_ORDER,
  type GapVerdict,
  type Verdict,
} from "./gap/verdicts";
import { frameFit, matchIntent, readGap, showsMistake } from "./match";
import { RELATION_PRIORITY, rank, type Candidate, type MatchTier } from "./rank";
import { readRequest } from "./request";
import type {
  CollocationHit,
  FormMatch,
  GapFrame,
  LanguageSearchRepository,
  MistakeHit,
  PatternHit,
  RelationHit,
  SenseFacets,
  SenseRef,
} from "./repository";
import { chooseCorrection } from "./text";
import {
  resultFrom,
  type BrowseResponse,
  type FitGuide,
  type GapFit,
  type GapSlot,
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
  comparison: "comparing",
  concession: "conceding a point",
  contrast: "contrast",
  decrease: "describing a decrease",
  emphasis: "emphasis",
  example: "giving examples",
  hedging: "softening a claim",
  importance: "importance",
  increase: "describing an increase",
  opinion: "giving an opinion",
  problem: "describing a problem",
  result: "showing a result",
};

type Resolved = { resolution: TermResolution; forms: FormMatch[] };
type Resolution = Resolved | { didYouMean: string[] } | undefined;

const quote = (text: string) => `“${text}”`;

export class LanguageSearchService {
  constructor(private readonly repo: LanguageSearchRepository) {}

  /**
   * Searches published language. Without filters the response is exactly the engine's answer.
   * With filters it is the same answer restricted to results whose sense matches every filter.
   * Invalid filters throw: callers validate input (src/language/filters.ts) first.
   */
  async search(input: string, filters?: SearchFilters): Promise<SearchResponse | null> {
    const applied = filters === undefined ? undefined : searchFiltersSchema.parse(filters);
    const response = await this.answer(input);
    if (!response || !hasFilters(applied)) return response;
    return this.restrict(response, applied);
  }

  /** One page of published senses matching the filters (at least one), in browse order. */
  async browse(filters: SearchFilters, page = 1): Promise<BrowseResponse> {
    const applied = searchFiltersSchema.parse(filters);
    if (!hasFilters(applied)) throw new Error("Browsing needs at least one filter");
    if (!Number.isInteger(page) || page < 1) throw new Error(`Invalid browse page: ${page}`);
    const [{ senseIds, total }, counts] = await Promise.all([
      this.repo.browseSenses(applied, {
        limit: BROWSE_PAGE_SIZE,
        offset: (page - 1) * BROWSE_PAGE_SIZE,
      }),
      this.repo.filterCounts(applied),
    ]);
    const summaries = await this.summaries(senseIds);
    return {
      filters: applied,
      page,
      pageSize: BROWSE_PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE)),
      items: senseIds.flatMap((id) => summaries.get(id) ?? []),
      counts,
    };
  }

  /**
   * Keeps the results, fit-guide rows and mistakes whose sense matches the filters. The reading,
   * groups, order and verdicts are the engine's; only what doesn't match is left out.
   */
  private async restrict(response: SearchResponse, filters: SearchFilters) {
    const results = response.groups.flatMap((group) => group.results);
    const mistakeSenses = MISTAKE_SENSES.get(response) ?? [];
    const facets = new Map(
      (await this.repo.senseFacets([...results.map((r) => r.senseId), ...mistakeSenses])).map(
        (f) => [f.senseId, f],
      ),
    );
    const keep = (senseId: string | undefined) => {
      const f = senseId === undefined ? undefined : facets.get(senseId);
      return f !== undefined && matchesFilters(f, filters);
    };

    const groups = response.groups
      .map((group) => ({ ...group, results: group.results.filter((r) => keep(r.senseId)) }))
      .filter((group) => group.results.length > 0);
    const visible = groups.flatMap((group) => group.results);
    // Guide rows name a result by its term, or for context gaps by its frame (the pattern).
    const shown = new Set(visible.flatMap((r) => [r.term, ...(r.pattern ? [r.pattern] : [])]));
    const rows = response.guide?.rows.filter((row) => shown.has(row.term)) ?? [];
    const { guide: _, ...rest } = response;
    return {
      ...rest,
      groups,
      ...(response.guide && rows.length > 0 && { guide: { ...response.guide, rows } }),
      mistakes: response.mistakes.filter((_, index) => keep(mistakeSenses[index])),
      outcome: visible.length === 0 ? "none" : response.outcome,
      filters: { applied: filters, before: results.length, after: visible.length },
    } satisfies SearchResponse;
  }

  /**
   * The engine's answer. The gap reader decides first whether the query asks for a word in a gap
   * (underscores, or an ellipsis between words, at most two) or is an ordinary search; markers
   * that aren't blanks are dropped before normalising, so "however..." searches "however".
   */
  private async answer(input: string): Promise<SearchResponse | null> {
    const query = input.trim().slice(0, MAX_QUERY_LENGTH);
    const plan = planGaps(query);
    const response = await this.interpret(query, plan.text, plan);
    if (response && plan.kind === "ordinary" && plan.note) response.gapNote = plan.note;
    return response;
  }

  private async interpret(
    query: string,
    text: string,
    plan: GapPlan,
  ): Promise<SearchResponse | null> {
    const normalised = normaliseQuery(text);
    if (!normalised) return null;

    const classification = readRequest(normalised);
    const base = { query, normalised };
    const response = await this.byIntent(base, classification, query, plan);
    return response && classification.task
      ? this.taskFirst(response, classification.task)
      : response;
  }

  private async byIntent(
    base: { query: string; normalised: string },
    classification: Classification,
    query: string,
    plan: GapPlan,
  ): Promise<SearchResponse | null> {
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
      case "CONTEXT_GAP": {
        if (plan.kind !== "gap") return this.gapSearch(base, []);
        const response = await this.gapAnswer(base, query, plan.blanks);
        // An ellipsis is only a possible blank: when nothing answers it, search as usual.
        const onlyEllipses = plan.blanks.every((blank) => blank.marker === "ellipsis");
        if (onlyEllipses && response.groups.length === 0) {
          return this.interpret(query, plan.withoutBlanks, { kind: "ordinary", text: "" });
        }
        return response;
      }
      case "LOOKUP":
        return this.lookup(base, base.normalised, []);
    }
  }

  // ── Term resolution ──────────────────────────────────────────────────────────────────────

  /** Exact form, then spelling variant, then a cautious typo correction (never silent). */
  private async resolve(term: string, found?: FormMatch[]): Promise<Resolution> {
    const forms = found ?? (await this.repo.findForms(term));
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
    const forms = await this.repo.findForms(term);
    if (forms.length === 0) {
      const read = await this.unresolvedRequest(base, c, term);
      if (read) return read;
    }
    const resolved = await this.resolve(term, forms);
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
    const [summaries, facets] = await Promise.all([
      this.summaries(relations.map((r) => r.toSenseId)),
      this.facets([...senses.map((sense) => sense.id), ...relations.map((r) => r.toSenseId)]),
    ]);
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
            // Phase 6B: a word of the same class first ("think" → "argue" before "in my opinion").
            classFit: sameWordClass(facets.get(sense.id), facets.get(relation.toSenseId)) ? 0 : 1,
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

  /**
   * Phase 6B: a request whose term isn't a form Lexora knows, read before any typo correction:
   * a stronger or weaker word ("very important"), a descriptor with a head word ("a large
   * increase"), or an idea rather than a word ("describing a trend"). Undefined: none of these.
   */
  private async unresolvedRequest(
    base: { query: string; normalised: string },
    c: Classification,
    term: string,
  ): Promise<SearchResponse | undefined> {
    const descriptor = readDescriptor(term);
    if (descriptor?.kind === "intensity") {
      const intent =
        descriptor.direction === "stronger" ? "STRONGER_ALTERNATIVE" : "WEAKER_ALTERNATIVE";
      const shifted = await this.relationSearch(base, { ...c, intent, term: descriptor.head });
      if (shifted.groups.length > 0 || c.intent === intent) return shifted;
      return this.relationSearch(base, { ...c, term: descriptor.head });
    }
    if (descriptor?.kind === "quality") {
      const described = await this.descriptorSearch(base, c, descriptor);
      if (described) return described;
      const plain = await this.relationSearch(base, { ...c, term: descriptor.head });
      const head = plain.interpretation.term?.resolved ?? descriptor.head;
      plain.interpretation.summary = `Lexora has nothing that says ${quote(descriptor.word)} with ${quote(head)} — ${lowerFirst(plain.interpretation.summary)}`;
      return plain;
    }
    const match = matchIntent(term, await this.repo.listIntents());
    if (!match) return undefined;
    return this.expressionSearch(base, {
      intent: "PHRASE",
      phrase: term,
      modifiers: c.modifiers,
    });
  }

  /**
   * Phase 6B: language for a head word with a size or speed descriptor ("a large increase"). The
   * descriptor's signals (descriptors.ts) must meet the head word, or a word related to it, in
   * authored content:
   *
   * 1. a collocation with both ("a substantial increase");
   * 2. a definition with both ("jump: to rise suddenly by a large amount"), or a relation from
   *    the head word whose note says it ("Surge means a sudden, large increase");
   * 3. a definition with the descriptor, and examples or collocations that use the head word
   *    ("considerable: large in size" · "rose by a considerable margin").
   *
   * Collocations come first, then words of the class the descriptor asks for (an adjective before
   * a noun, an adverb after a verb), then the rest; within that, stronger evidence, the signal's
   * priority, IELTS relevance and headword. Undefined when nothing has such evidence.
   */
  private async descriptorSearch(
    base: { query: string; normalised: string },
    c: Classification,
    d: Extract<Descriptor, { kind: "quality" }>,
  ): Promise<SearchResponse | undefined> {
    const { signals, glosses } = signalsOf(d.qualities);
    const definedPromise = this.repo.sensesDefinedWith(glosses);
    const forms = await this.repo.findForms(d.head);
    if (forms.length === 0) return undefined;
    const own = (await this.sensesFor(forms)).map((sense) => sense.id);
    const related = await this.repo.relationsFrom(own, SYNONYM_TYPES);
    const family = new Set([...own, ...related.map((r) => r.toSenseId)]);
    const familyForms = [
      ...new Set((await this.repo.formsOfSenses([...family])).map((f) => f.form)),
    ];
    const [collocations, defined] = await Promise.all([
      this.repo.collocationsContaining(familyForms),
      definedPromise,
    ]);

    const asked = normaliseTerm(c.term ?? d.head);
    const typed = new Set([asked, asked.replace(/^(?:a|an|the) /, "")]);
    const usedWith = (texts: readonly string[]) =>
      familyForms.find((form) => texts.some((text) => containsPhrase(text, form)));

    // Sense evidence, the strongest per sense: 0 definition or relation note, 1 usage.
    const senseEvidence = new Map<string, { strength: number; priority: number; reason: string }>();
    const offer = (senseId: string, strength: number, priority: number, reason: string) => {
      const known = senseEvidence.get(senseId);
      if (
        known &&
        (known.strength < strength || (known.strength === strength && known.priority <= priority))
      )
        return;
      senseEvidence.set(senseId, { strength, priority, reason });
    };
    for (const sense of defined) {
      const gloss = glossRank(sense.definition, glosses);
      if (gloss < 0) continue;
      if (
        family.has(sense.senseId) ||
        familyForms.some((f) => containsPhrase(sense.definition, f))
      ) {
        offer(sense.senseId, 0, gloss, `Its definition describes ${quote(asked)}`);
        continue;
      }
      const word = usedWith(sense.usage);
      if (word)
        offer(
          sense.senseId,
          1,
          gloss,
          `Means ${d.qualities[0]}, and Lexora uses it with ${quote(word)}`,
        );
    }
    const headword = forms[0]!.headword;
    for (const relation of related) {
      // The note must say it of the head word ("a sudden, large increase"), not elsewhere
      // ("slightly less formal").
      const note = normaliseTerm(relation.note ?? "");
      const rank = note ? describesNear(note, familyForms, glosses, signals) : -1;
      if (rank >= 0) offer(relation.toSenseId, 0, rank, relationReason(relation, headword));
    }

    const phrases = collocations
      .map((row) => {
        const phrase = normaliseTerm(row.phrase);
        return {
          row,
          rank: signalRank(phrase, signals),
          shape: phraseShape(phrase, familyForms, signals),
        };
      })
      .filter(({ row, rank }) => rank >= 0 && !typed.has(normaliseTerm(row.phrase)));
    if (phrases.length === 0 && senseEvidence.size === 0) return undefined;

    const ids = [
      ...phrases.flatMap(({ row }) => [
        row.senseId,
        ...(row.linkedSenseId ? [row.linkedSenseId] : []),
      ]),
      ...senseEvidence.keys(),
    ];
    const [summaries, facets] = await Promise.all([this.summaries(ids), this.facets(ids)]);
    const relevance = { core: 0, high: 1, useful: 2 } as const;
    const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

    const collocationResults = phrases
      .flatMap(({ row, rank, shape }) => {
        const parent = summaries.get(row.senseId);
        if (!parent) return [];
        const result = collocationResult(row, parent, summaries, headword);
        const reason = `A collocation for ${quote(asked)}${row.note ? ` — ${row.note}` : ""}`;
        return [{ result: { ...result, reason }, rank, fit: shape === d.reading ? 0 : 1 }];
      })
      .sort(
        (a, b) =>
          // The shape asked for first: "a large increase" → "a significant increase".
          a.fit - b.fit ||
          a.rank - b.rank ||
          relevance[summaries.get(a.result.senseId)!.ieltsRelevance] -
            relevance[summaries.get(b.result.senseId)!.ieltsRelevance] ||
          byCode(a.result.key, b.result.key),
      )
      .map(({ result }) => result);
    const shown = new Set(collocationResults.map((result) => result.slug));
    const wanted: PartOfSpeech[] =
      d.reading === "noun" ? ["adjective", "adjective_phrase"] : ["adverb", "adverbial_phrase"];
    const last: PartOfSpeech[] =
      d.reading === "noun" ? ["adverb", "adverbial_phrase"] : ["adjective", "adjective_phrase"];
    const classOrder = (senseId: string) => {
      const pos = facets.get(senseId)?.partOfSpeech;
      return pos && wanted.includes(pos) ? 0 : pos && last.includes(pos) ? 2 : 1;
    };
    const modifier = (senseId: string) =>
      ["adjective", "adjective_phrase", "adverb", "adverbial_phrase"].includes(
        facets.get(senseId)?.partOfSpeech ?? "",
      );
    const wordResults = [...senseEvidence.entries()]
      .flatMap(([senseId, evidence]) => {
        const summary = summaries.get(senseId);
        // Usage alone ("rose by a considerable margin") counts for a modifier, not for a verb
        // whose definition names another change ("dip: to fall slightly").
        if (evidence.strength === 1 && !modifier(senseId)) return [];
        return summary && !shown.has(summary.slug) ? [{ summary, evidence }] : [];
      })
      .sort(
        (a, b) =>
          classOrder(a.summary.senseId) - classOrder(b.summary.senseId) ||
          a.evidence.strength - b.evidence.strength ||
          a.evidence.priority - b.evidence.priority ||
          relevance[a.summary.ieltsRelevance] - relevance[b.summary.ieltsRelevance] ||
          byCode(a.summary.headword.toLowerCase(), b.summary.headword.toLowerCase()) ||
          byCode(a.summary.senseId, b.summary.senseId),
      )
      .map(({ summary, evidence }) => resultFrom(summary, evidence.reason));

    return respond(base, c, {
      summary: `Language for ${quote(asked)}`,
      term: describeMatch(d.head, forms),
      descriptor: { word: d.word, qualities: [...d.qualities] },
      groups: [
        { label: "Collocations", results: collocationResults.slice(0, MAX_DESCRIBED) },
        { label: "Words and phrases", results: wordResults.slice(0, MAX_DESCRIBED) },
      ],
    });
  }

  /**
   * Phase 6B: within each group, the results used in the task the query names come first (the
   * engine's order is kept otherwise). The task never hides a result.
   */
  private async taskFirst(response: SearchResponse, task: IeltsTask) {
    const ids = response.groups.flatMap((group) => group.results.map((r) => r.senseId));
    const facets = await this.facets(ids);
    const used = (r: SearchResult) => facets.get(r.senseId)?.ieltsTasks.includes(task) ?? false;
    response.groups = response.groups.map((group) => ({
      ...group,
      results: [...group.results.filter(used), ...group.results.filter((r) => !used(r))],
    }));
    const any = response.groups.some((group) => group.results.some(used));
    response.interpretation = {
      ...response.interpretation,
      task,
      ...(any && {
        summary: `${response.interpretation.summary} · ${TASK_LABEL[task]} first`,
      }),
    };
    return response;
  }

  // ── Prepositions ─────────────────────────────────────────────────────────────────────────

  private async prepositionSearch(
    base: { query: string; normalised: string },
    c: Classification,
  ): Promise<SearchResponse> {
    // Phase 6B: "preposition after an increase" asks about the noun: patterns authored with an
    // article ("an increase in + noun") come first.
    const noun = ARTICLE.test(c.term!);
    const term = c.term!.replace(ARTICLE, "");
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
          typePriority: noun && !ARTICLE.test(pattern.pattern.toLowerCase()) ? 1 : 0,
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

      if (c.intent === "SENTENCE_PATTERN") {
        moveKindFirst(groups, "sentence_pattern");
        // Phase 6B: and within each group, so a starter is what the learner sees first.
        for (const group of groups) group.results = kindFirst(group.results, "sentence_pattern");
      }
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

  /**
   * A context-gap answer (Phase 4 Step 4.2). The Phase 3 verb-frame answer comes first and, when a
   * frame fits the first blank, stands as it is. Every other blank is matched on its own against
   * preposition patterns, collocations and linkers, without combining candidates across blanks;
   * when nothing matches, the verb-frame answer (or its prompt) is the answer.
   */
  private async gapAnswer(
    base: { query: string; normalised: string },
    query: string,
    blanks: Blank[],
  ): Promise<SearchResponse> {
    const framed = withFrameVerdicts(await this.gapSearch(base, blanks));
    const frameFits = framed.groups.length > 0;
    const allWindows = gapWindows(base.normalised, query, blanks);
    const windows = allWindows.filter((window) => !(frameFits && window.index === 0));
    // Step 4.5: two blanks one authored structure could fill together.
    const between = wordsBetween(base.normalised, query, blanks);
    const pair =
      between && allWindows.length === 2
        ? { between, first: allWindows[0]!, second: allWindows[1]! }
        : undefined;
    if (windows.length === 0 && !pair) return framed;

    const found = await this.gapCandidates(windows, pair, frameFits, base.normalised);
    if (found.candidates.length === 0 && found.pairs.length === 0) return framed;

    const twoGaps = blanks.length > 1;
    const pairGroups: ResultGroup[] =
      found.pairs.length > 0
        ? [
            {
              label:
                found.pairs.length === 1
                  ? `Both gaps · ${found.pairs[0]!.fill} … ${found.pairs[0]!.preposition}`
                  : "Both gaps",
              results: found.pairs.flatMap((candidate) => {
                const summary = found.summaries.get(candidate.senseId);
                return summary
                  ? [gapCandidateResult(summary, candidate, found.verdicts.get(candidate)!)]
                  : [];
              }),
            },
          ]
        : [];
    const groups: ResultGroup[] = [...pairGroups, ...(frameFits ? framed.groups : [])];
    const windowGroups: ResultGroup[] = [];
    for (const window of windows) {
      for (const type of GAP_CANDIDATE_TYPES) {
        const list = found.candidates.filter((c) => c.gap === window.index && c.type === type);
        if (list.length === 0) continue;
        const label = gapGroupLabel(type, list, window);
        windowGroups.push({
          label: twoGaps ? `Gap ${window.index + 1} · ${label}` : label,
          results: list.flatMap((candidate) => {
            const summary = found.summaries.get(candidate.senseId);
            return summary
              ? [gapCandidateResult(summary, candidate, found.verdicts.get(candidate)!)]
              : [];
          }),
        });
      }
    }

    // Phase 6B: a group with nothing that fits (every candidate ruled out) comes after the others.
    const fitting = (group: ResultGroup) =>
      group.results.some((r) => r.gapMatch && !RULED_OUT.has(r.gapMatch.verdict));
    groups.push(...windowGroups.filter(fitting), ...windowGroups.filter((g) => !fitting(g)));

    const gaps = (framed.gaps ?? []).map((slot) => {
      if (slot.type !== "unknown") return slot;
      const first =
        found.candidates.find(
          (c) => c.gap === slot.index && !RULED_OUT.has(found.verdicts.get(c)!.verdict),
        ) ??
        found.candidates.find((c) => c.gap === slot.index) ??
        found.pairs[0];
      return first ? { ...slot, type: publicGapType(first) } : slot;
    });
    const newGroups = groups.filter((group) => !framed.groups.includes(group));
    return respond(
      base,
      { intent: "CONTEXT_GAP", modifiers: [] },
      {
        summary: frameFits
          ? framed.interpretation.summary
          : newGroups.length === 1 && !twoGaps
            ? newGroups[0]!.label!
            : twoGaps
              ? "Language Lexora knows for these gaps"
              : "Language Lexora knows for this gap",
        groups,
        ...(frameFits && framed.guide && { guide: framed.guide }),
        mistakes: found.mistakes,
        ...(framed.gap && { gap: framed.gap }),
        gaps,
      },
    );
  }

  /**
   * Candidates for each window from three bounded reads (and the verb frames, only when a frame's
   * head and object stand before a blank), ordered by the fixed rule.
   */
  private async gapCandidates(
    windows: GapWindow[],
    pair?: { between: string[]; first: GapWindow; second: GapWindow },
    frameFits = false,
    normalised = "",
  ) {
    const unique = (list: string[]) => [...new Set(list)];
    const words = unique(windows.flatMap(anchorWords));
    // Phase 6B: read alongside the candidates, only where a linker could go.
    const opposites = windows.some((window) => linkerSlot(window))
      ? this.oppositesAround(normalised)
      : Promise.resolve(undefined);
    const [patterns, templates, linkers, pairPatterns, pairFrames] = await Promise.all([
      this.repo.findGapPatterns(
        unique(windows.flatMap((window) => [...baseCandidates(window), ...headCandidates(window)])),
        unique(windows.flatMap(formCandidates)),
      ),
      words.length > 0
        ? this.repo.findCollocationTemplates(words)
        : Promise.resolve({ templates: [], forms: [] }),
      windows.some((window) => linkerSlot(window)) ? this.repo.listLinkers() : Promise.resolve([]),
      // Step 4.5: the two bounded reads a structure spanning both blanks needs.
      pair ? this.repo.findPairPatterns(pair.between.join(" ")) : Promise.resolve([]),
      // A frame pair needs an object the frame authors, which also makes the first blank's
      // protected verb-frame answer fit: only then are the frames read for pairs.
      pair && frameFits ? this.repo.listGapFrames() : Promise.resolve([]),
    ]);
    const frames =
      pair && frameFits
        ? pairFrames
        : windows.some((window) => reachesFrameHead(window, patterns))
          ? await this.repo.listGapFrames()
          : [];
    const families = inflectionFamilies(templates.forms);
    const pairs = pair ? jointCandidates(pair.between, pair.first, frames, pairPatterns) : [];
    const raw = windows.flatMap((window) => [
      ...prepositionCandidates(window, patterns),
      ...framePrepositionCandidates(window, patterns, frames),
      ...collocationCandidates(window, templates.templates, families),
      ...linkerCandidates(window, linkers),
    ]);
    if (raw.length === 0 && pairs.length === 0) {
      return {
        candidates: [],
        pairs: [],
        verdicts: new Map<GapCandidate, Verdict>(),
        summaries: new Map<string, SenseSummary>(),
        mistakes: [],
        linkers,
      };
    }

    // One read for the mistakes of every preposition and collocation candidate's own sense: the
    // evidence for "unlikely", and the linked ones shown with the answer. Phase 6B: in the same
    // round, the word classes of the words next to each blank and of the candidates' words.
    const all = [...pairs, ...raw];
    const mistakeSenses = unique(all.filter((c) => c.type !== "linker").map((c) => c.senseId));
    const classWords = lexiconWords(windows, raw);
    const [summaries, senseMistakes, classHits] = await Promise.all([
      this.summaries(all.map((c) => c.senseId)),
      mistakeSenses.length > 0
        ? this.repo.mistakesOf(mistakeSenses)
        : Promise.resolve([] as MistakeHit[]),
      classWords.length > 0 ? this.repo.wordClasses(classWords) : Promise.resolve([]),
    ]);
    const lexicon: Lexicon = buildLexicon(classHits);
    const contrast = await opposites;
    // Authored opposites on the two sides of a linker's blank ("rose" … "fell") suggest contrast:
    // contrast linkers are listed first. Which linker fits still depends on the meaning.
    const functionOrder: readonly DiscourseFunction[] = contrast
      ? ["contrast", ...DISCOURSE_FUNCTIONS.filter((fn) => fn !== "contrast")]
      : DISCOURSE_FUNCTIONS;
    const firstFunction = new Map(linkers.map((l) => [l.senseId, l.functions[0]]));
    const windowOf = new Map(windows.map((window) => [window.index, window]));
    const readings = new Map(windows.map((window) => [window.index, readSlot(window, lexicon)]));
    const conflictOf = (candidate: GapCandidate) =>
      classConflict(candidate, windowOf.get(candidate.gap)!, readings.get(candidate.gap)!, lexicon);
    // A collocation whose word the sentence rules out ("suffer reduce poverty") isn't an answer.
    const kept = raw.filter((c) => c.type !== "collocation" || !conflictOf(c));
    const verdicts = new Map<GapCandidate, Verdict>();
    for (const candidate of pairs) {
      const own = senseMistakes.filter((m) => m.senseId === candidate.senseId);
      verdicts.set(
        candidate,
        jointVerdict(candidate, pair!.first, pair!.second, pair!.between, own, lexicon),
      );
    }
    for (const candidate of kept) {
      const window = windowOf.get(candidate.gap)!;
      const own = senseMistakes.filter((m) => m.senseId === candidate.senseId);
      const fn = firstFunction.get(candidate.senseId);
      const evidence = { lexicon, conflict: conflictOf(candidate) };
      verdicts.set(
        candidate,
        candidate.type === "preposition"
          ? prepositionVerdict(candidate, window, own, evidence)
          : candidate.type === "frame_preposition"
            ? framePrepositionVerdict(candidate, window, own, evidence)
            : candidate.type === "collocation"
              ? collocationVerdict(candidate, window, own)
              : linkerVerdict(
                  linkerSlot(window)!,
                  fn ? FUNCTION_LABEL[fn] : undefined,
                  fn === "contrast" ? contrast : undefined,
                ),
      );
    }
    const linked = new Set(
      all.flatMap((c) => (c.evidence.mistakeId ? [c.evidence.mistakeId] : [])),
    );
    const mistakes = senseMistakes.filter(
      (m) => linked.has(m.id) || [...verdicts.values()].some((v) => v.mistake?.id === m.id),
    );
    const candidates = windows.flatMap((window) =>
      GAP_CANDIDATE_TYPES.flatMap((type) =>
        orderCandidates(
          kept.filter((c) => c.gap === window.index && c.type === type),
          (senseId): CandidateFacts | undefined => {
            const summary = summaries.get(senseId);
            if (!summary) return undefined;
            return {
              relevance: summary.ieltsRelevance,
              headword: summary.headword.toLowerCase(),
              ...(type === "linker" && { firstFunction: firstFunction.get(senseId) }),
            };
          },
          functionOrder,
        )
          // Verdict first (a stable sort keeps the fixed order within each verdict).
          .sort(
            (a, b) =>
              VERDICT_ORDER[verdicts.get(a)!.verdict] - VERDICT_ORDER[verdicts.get(b)!.verdict],
          ),
      ),
    );
    return {
      candidates,
      pairs: orderPairs(pairs, verdicts, summaries),
      verdicts,
      summaries,
      mistakes,
      linkers,
    };
  }

  /**
   * Phase 6B: two words the content authors as opposites ("rise" / "fall"), one before the
   * query's first blank and one after it. Three small reads: the words' items, their senses, and
   * the opposite relations between them.
   */
  private async oppositesAround(normalised: string) {
    const list = words(normalised);
    const at = list.indexOf("___");
    if (at < 0) return undefined;
    const content = (side: string[]) =>
      side.filter((word) => word !== "___" && !isFunctionWord(word));
    const [left, right] = [content(list.slice(0, at)), content(list.slice(at + 1))];
    if (left.length === 0 || right.length === 0) return undefined;
    const forms = await this.repo.findFormsIn([...new Set([...left, ...right])]);
    const leftItems = new Set(forms.filter((f) => left.includes(f.form)).map((f) => f.itemId));
    const rightItems = new Set(forms.filter((f) => right.includes(f.form)).map((f) => f.itemId));
    if (leftItems.size === 0 || rightItems.size === 0) return undefined;
    const senses = await this.repo.sensesOfItems([...new Set([...leftItems, ...rightItems])]);
    const itemOf = new Map(senses.map((sense) => [sense.id, sense.itemId]));
    const relations = await this.repo.relationsFrom(
      senses.filter((sense) => leftItems.has(sense.itemId)).map((sense) => sense.id),
      ["opposite"],
    );
    const hit = relations.find((r) => rightItems.has(itemOf.get(r.toSenseId) ?? ""));
    if (!hit) return undefined;
    const formIn = (side: string[], itemId: string) =>
      forms.find((f) => f.itemId === itemId && side.includes(f.form))!.form;
    return {
      left: formIn(left, itemOf.get(hit.fromSenseId)!),
      right: formIn(right, itemOf.get(hit.toSenseId)!),
    };
  }

  private async gapSearch(
    base: { query: string; normalised: string },
    blanks: Blank[],
  ): Promise<SearchResponse> {
    const c: Classification = { intent: "CONTEXT_GAP", modifiers: [] };
    const reading = readGap(base.normalised);
    if (!reading.object) {
      return respond(base, c, {
        summary: "Find a word for the gap — add the words that come after it",
        groups: [],
        gap: reading,
        gaps: gapSlots(base.normalised, blanks, false),
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
      gaps: gapSlots(base.normalised, blanks, fitting.length > 0),
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

    // The repository finds mistakes containing the words; only those the query shows count.
    const mistakes = (await this.repo.findMistakes(text)).filter((m) => showsMistake(text, m));
    if (mistakes.length > 0) return this.mistakeLookup(base, c, mistakes);

    // An authored intent trigger on its own ("express contrast") asks for that intent, as
    // "I want to express contrast" does. Exact triggers only: nothing is inferred from other words.
    const trigger = text.replace(/\?+$/, "").trim();
    if (await this.repo.hasIntentTrigger(trigger)) {
      return this.expressionSearch(base, {
        intent: "CONTEXTUAL_EXPRESSION",
        phrase: trigger,
        modifiers,
      });
    }

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
      const best = primaryForms(text, contained);
      const others = otherForms(text, best[0]!, contained);
      const [response, otherSenses] = await Promise.all([
        this.itemLookup(
          base,
          c,
          best,
          { input: text, resolved: best[0]!.headword, via: "exact" },
          6,
        ),
        this.sensesFor(others),
      ]);
      if (otherSenses.length === 0) return response;
      // Phase 6B: the query's other known terms, after the one it is about.
      const summaries = await this.summaries(otherSenses.map((sense) => sense.id));
      const formOf = new Map(others.map((form) => [form.itemId, form.form]));
      const results = otherSenses.flatMap((sense) => {
        const summary = summaries.get(sense.id);
        if (!summary || response.groups.some((g) => g.results.some((r) => r.key === sense.id))) {
          return [];
        }
        return [resultFrom(summary, `Also in your search: ${quote(formOf.get(sense.itemId)!)}`)];
      });
      if (results.length > 0) response.groups.push({ label: "Also in your search", results });
      return response;
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

  private async facets(ids: readonly string[]) {
    const unique = [...new Set(ids)];
    const list = unique.length > 0 ? await this.repo.senseFacets(unique) : [];
    return new Map(list.map((facets) => [facets.senseId, facets]));
  }
}

// ── Response shaping ───────────────────────────────────────────────────────────────────────

function respond(
  base: { query: string; normalised: string },
  c: Classification,
  parts: {
    summary: string;
    term?: TermResolution;
    descriptor?: SearchResponse["interpretation"]["descriptor"];
    groups: ResultGroup[];
    guide?: FitGuide;
    mistakes?: MistakeHit[];
    outcome?: SearchResponse["outcome"];
    gap?: SearchResponse["gap"];
    gaps?: GapSlot[];
  },
): SearchResponse {
  const groups = parts.groups.filter((group) => group.results.length > 0);
  const hits = dedupeBy(parts.mistakes ?? [], (m) => m.id);
  const mistakes = hits.map(({ wrong, right, explanation }) => ({
    wrong,
    right,
    explanation,
  }));
  const response: SearchResponse = {
    query: base.query,
    normalised: base.normalised,
    interpretation: {
      intent: c.intent,
      summary: parts.summary,
      ...(parts.term && { term: parts.term }),
      modifiers: c.modifiers,
      ...(parts.descriptor && { descriptor: parts.descriptor }),
    },
    groups,
    ...(parts.guide && parts.guide.rows.length > 0 && { guide: parts.guide }),
    mistakes,
    ...(parts.gap && { gap: parts.gap }),
    ...(parts.gaps && parts.gaps.length > 0 && { gaps: parts.gaps }),
    outcome: groups.length === 0 ? "none" : (parts.outcome ?? "results"),
  };
  MISTAKE_SENSES.set(
    response,
    hits.map((m) => m.senseId),
  );
  return response;
}

/**
 * The sense of each mistake in a response, in order, for filtering. Kept beside the response
 * rather than in it, so the response a visitor receives is unchanged by filters existing.
 */
const MISTAKE_SENSES = new WeakMap<SearchResponse, string[]>();

/** Verdicts that rule a candidate out for this sentence. */
const RULED_OUT = new Set<GapVerdict>(["unlikely", "not_supported"]);

const GAP_CANDIDATE_TYPES: readonly GapCandidateType[] = [
  "preposition",
  "frame_preposition",
  "collocation",
  "linker",
];

/**
 * The kind a learner sees: the preposition after a frame's object is a preposition; a pair is
 * its structure's kind (a verb frame, or a preposition pattern).
 */
const publicGapType = (candidate: GapCandidate) =>
  candidate.type === "joint"
    ? candidate.structure === "frame"
      ? ("verb_frame" as const)
      : ("preposition" as const)
    : candidate.type === "frame_preposition"
      ? ("preposition" as const)
      : candidate.type;

/**
 * Pairs in their fixed order (Step 4.5): verdict; verb frames before patterns; IELTS relevance;
 * headword by code point; evidence id; then the authored preposition order (a stable sort).
 */
function orderPairs(
  pairs: GapCandidate[],
  verdicts: Map<GapCandidate, Verdict>,
  summaries: Map<string, SenseSummary>,
) {
  const relevance = { core: 0, high: 1, useful: 2 } as const;
  const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return pairs
    .filter((pair) => summaries.has(pair.senseId))
    .sort((a, b) => {
      const [sa, sb] = [summaries.get(a.senseId)!, summaries.get(b.senseId)!];
      return (
        VERDICT_ORDER[verdicts.get(a)!.verdict] - VERDICT_ORDER[verdicts.get(b)!.verdict] ||
        (a.structure === "frame" ? 0 : 1) - (b.structure === "frame" ? 0 : 1) ||
        relevance[sa.ieltsRelevance] - relevance[sb.ieltsRelevance] ||
        byCode(sa.headword.toLowerCase(), sb.headword.toLowerCase()) ||
        byCode(a.evidence.id, b.evidence.id)
      );
    });
}

/** The heading of one blank's candidates of one kind. Describes what was read, not a verdict. */
function gapGroupLabel(type: GapCandidateType, list: GapCandidate[], window: GapWindow) {
  if (type === "preposition") {
    const base = list[0]!.term.split(" ").slice(0, -1).join(" ");
    return `Prepositions after ${quote(base)}`;
  }
  if (type === "frame_preposition") return `Prepositions after ${quote(list[0]!.context!)}`;
  if (type === "collocation") return "Collocations with these words";
  const slot = linkerSlot(window);
  return slot === "start"
    ? "Linkers that start a sentence"
    : slot === "between_commas"
      ? "Linkers between commas"
      : "Linkers that join two clauses";
}

/** A candidate as a result card: the sense it belongs to, its words, and its evidence. */
function gapCandidateResult(
  summary: SenseSummary,
  candidate: GapCandidate,
  verdict: Verdict,
): SearchResult {
  const joint = candidate.type === "joint";
  return resultFrom(summary, verdict.reason, {
    key: joint
      ? `${candidate.evidence.id}:gaps:${candidate.fill}:${candidate.preposition}`
      : `${candidate.evidence.id}:gap${candidate.gap}:${candidate.fill}`,
    term: candidate.term,
    ...((candidate.type === "preposition" || candidate.type === "frame_preposition" || joint) && {
      pattern: candidate.evidence.display,
    }),
    fill: { word: candidate.fill, ...(joint && { preposition: candidate.preposition }) },
    gapMatch: {
      gap: candidate.gap,
      ...(joint && { gaps: [0, 1] as [0, 1] }),
      type: publicGapType(candidate),
      evidence: candidate.evidence.id,
      verdict: verdict.verdict,
      signals: verdict.signals,
    },
  });
}

/**
 * Verb-frame results get a verdict beside their protected Phase 3 `fit`; matching, order and
 * reasons stay as they were. The evidence is the frame as authored (frames have no id here).
 */
function withFrameVerdicts(response: SearchResponse) {
  const prepositionRead = Boolean(response.gap?.preposition);
  response.groups = response.groups.map((group) => ({
    ...group,
    results: group.results.map((result) =>
      result.fit && !result.gapMatch
        ? {
            ...result,
            gapMatch: {
              gap: 0 as const,
              type: "verb_frame" as const,
              evidence: result.pattern ?? result.key,
              ...frameVerdict(result.fit, prepositionRead),
            },
          }
        : result,
    ),
  }));
  return response;
}

/**
 * The blanks of a gap query as the response reports them: in order, each at its `___` token in
 * the normalised query. The first blank is a verb frame when a frame fits it (the Phase 3 reading
 * covers the first blank only); anything else is `unknown` until later Step 4 analysers.
 */
function gapSlots(normalised: string, blanks: Blank[], frameFits: boolean): GapSlot[] {
  const positions = words(normalised).flatMap((word, at) => (word === "___" ? [at] : []));
  return blanks.slice(0, 2).flatMap((blank, index): GapSlot[] => {
    const at = positions[index];
    if (at === undefined) return [];
    return [
      {
        index: index as 0 | 1,
        at,
        marker: blank.marker,
        type: index === 0 && frameFits ? "verb_frame" : "unknown",
      },
    ];
  });
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

const ARTICLE = /^(?:a|an|the) /;

function kindFirst(results: SearchResult[], kind: SearchResult["kind"]) {
  return [...results.filter((r) => r.kind === kind), ...results.filter((r) => r.kind !== kind)];
}

/** Where a run of words starts in a list of words, or -1. */
function runAt(list: readonly string[], run: readonly string[]) {
  for (let at = 0; at + run.length <= list.length; at++) {
    if (run.every((word, i) => list[at + i] === word)) return at;
  }
  return -1;
}

/**
 * The known term a longer query is about (Phase 6B). A pattern in use comes first: a form of two
 * or more words ending with a preposition, with more of the query after it ("depend on public
 * transport" → depend on, with "public transport" as its object). Otherwise, as before, the
 * longest known term.
 */
function primaryForms(text: string, contained: FormMatch[]) {
  const list = words(text);
  const inUse = contained.filter((form) => {
    const run = words(form.form);
    if (run.length < 2 || !(GAP_PREPOSITIONS as readonly string[]).includes(run.at(-1)!)) {
      return false;
    }
    const at = runAt(list, run);
    return at >= 0 && at + run.length < list.length;
  });
  const pool = inUse.length > 0 ? inUse : contained;
  const longest = Math.max(...pool.map((form) => form.form.length));
  return pool.filter((form) => form.form.length === longest);
}

/**
 * The query's other known terms (Phase 6B): items whose form doesn't overlap the primary term's
 * words, one form per item, longest first.
 */
function otherForms(text: string, primary: FormMatch, contained: FormMatch[]) {
  const list = words(text);
  const run = words(primary.form);
  const from = runAt(list, run);
  const to = from + run.length - 1;
  const seen = new Set([primary.itemId]);
  return [...contained]
    .sort((a, b) => b.form.length - a.form.length || (a.itemId < b.itemId ? -1 : 1))
    .filter((form) => {
      if (seen.has(form.itemId)) return false;
      const own = words(form.form);
      const at = runAt(list, own);
      if (at < 0 || (at <= to && at + own.length - 1 >= from)) return false;
      seen.add(form.itemId);
      return true;
    });
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

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** At most this many results per group of a descriptor answer. */
const MAX_DESCRIBED = 8;

const TASK_LABEL: Record<IeltsTask, string> = {
  "writing-1": "Writing Task 1",
  "writing-2": "Writing Task 2",
  "speaking-1": "Speaking Part 1",
  "speaking-2": "Speaking Part 2",
  "speaking-3": "Speaking Part 3",
};

/** Parts of speech that substitute for one another: a word and the phrase of its class. */
const WORD_CLASS: Record<PartOfSpeech, string> = {
  noun: "noun",
  noun_phrase: "noun",
  verb: "verb",
  verb_phrase: "verb",
  adjective: "adjective",
  adjective_phrase: "adjective",
  adverb: "adverb",
  adverbial_phrase: "adverb",
  prepositional_phrase: "adverb",
  conjunction: "conjunction",
  preposition: "preposition",
  clause_frame: "clause",
};

/**
 * Phase 6B: whether a related sense can take its source's place in a sentence: the same word
 * class, or both linkers (their notes explain position). Unknown facets don't penalise.
 */
function sameWordClass(from: SenseFacets | undefined, to: SenseFacets | undefined) {
  if (!from || !to) return true;
  if (from.kind === "linker" && to.kind === "linker") return true;
  return WORD_CLASS[from.partOfSpeech] === WORD_CLASS[to.partOfSpeech];
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
