/**
 * An in-memory LanguageSearchRepository over the rows the importer would write, so search logic
 * is unit-tested without PostgreSQL. It mirrors the database repository's visibility rules
 * (published only) and uses pg_trgm-style similarity for typo candidates.
 * Test infrastructure only; the golden suite runs against the real database repository.
 */
import {
  FILTER_DIMENSIONS,
  FILTER_VALUES,
  matchesFilters,
  matchesUse,
  type FilterFacets,
  type SearchFilters,
} from "@/language/filters";
import type { FramePart, SenseSummary } from "@/language/model";
import { toGapFrame } from "@/language/search/match";
import type {
  CollocationHit,
  CollocationTemplates,
  FilterCounts,
  FormMatch,
  GapPatternHit,
  GapFrame,
  IntentDefinition,
  LanguageSearchRepository,
  LinkerHit,
  MistakeHit,
  PatternHit,
  RelationHit,
  SenseFacets,
  SenseRef,
} from "@/language/search/repository";
import { stem, trigramSimilarity } from "@/language/search/text";
import type { DiscourseFunction, ItemKind, RelationType } from "@/language/schema/vocabulary";
import type { ContentRows } from "@/server/content/build";

/** pg_trgm's default similarity threshold, as used by the `%` operator. */
const SIMILARITY = 0.3;

export class MemoryLanguageRepository implements LanguageSearchRepository {
  constructor(private readonly rows: ContentRows) {}

  private get items() {
    return this.rows.items.filter((item) => item.status === "published");
  }

  private isLiveSense(id: string) {
    const sense = this.rows.senses.find((s) => s.id === id);
    if (!sense || sense.status === "retired") return false;
    return this.items.some((item) => item.id === sense.itemId);
  }

  async getSenseSummaries(ids: readonly string[]): Promise<SenseSummary[]> {
    return ids.flatMap((id) => {
      if (!this.isLiveSense(id)) return [];
      const sense = this.rows.senses.find((s) => s.id === id)!;
      const item = this.items.find((i) => i.id === sense.itemId)!;
      const example = this.rows.examples
        .filter((e) => e.senseId === id)
        .sort((a, b) => a.position - b.position)[0];
      const pattern = this.rows.prepositionPatterns.find((p) => p.senseId === id);
      return [
        {
          senseId: id,
          slug: item.slug,
          headword: item.headword,
          kind: item.kind,
          ...(sense.label && { senseLabel: sense.label }),
          definition: sense.definition,
          bestWhen: sense.bestWhen,
          registers: sense.registers,
          skills: sense.skills,
          ...(sense.strength && { strength: sense.strength as 1 | 2 | 3 }),
          ieltsRelevance: sense.ieltsRelevance,
          ...(example && { example: { text: example.text, highlights: example.highlights } }),
          collocations: this.rows.collocations
            .filter((c) => c.senseId === id)
            .slice(0, 4)
            .map((c) => c.phrase),
          ...(pattern && { pattern: pattern.pattern }),
        },
      ];
    });
  }

  async findForms(normalised: string) {
    return this.findFormsIn([normalised]);
  }

  async findFormsIn(phrases: readonly string[]): Promise<FormMatch[]> {
    return this.rows.forms
      .filter((form) => phrases.includes(form.normalized))
      .flatMap((form) => {
        const item = this.items.find((i) => i.id === form.itemId);
        if (!item) return [];
        return [
          {
            itemId: item.id,
            slug: item.slug,
            headword: item.headword,
            kind: item.kind,
            form: form.normalized,
            formType: form.formType,
            ...(form.region && { region: form.region }),
            isDefault: Boolean(form.isDefault),
          },
        ];
      })
      .sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.itemId.localeCompare(b.itemId),
      );
  }

  async findTermCandidates(normalised: string) {
    const terms = [
      ...this.rows.forms
        .filter((f) => this.items.some((i) => i.id === f.itemId))
        .map((f) => f.normalized),
      ...this.rows.collocations.filter((c) => this.isLiveSense(c.senseId)).map((c) => c.normalized),
      ...this.liveBases(),
    ];
    return similar(terms, normalised);
  }

  async findPatternBaseCandidates(normalised: string) {
    return similar(this.liveBases(), normalised);
  }

  private liveBases() {
    return this.rows.prepositionPatterns
      .filter((p) => this.isLiveSense(p.senseId))
      .map((p) => p.baseNormalized);
  }

  async findPatternsByBase(normalised: string) {
    return this.patterns((p) => p.baseNormalized === normalised);
  }

  async patternsOf(senseIds: readonly string[]) {
    return this.patterns((p) => senseIds.includes(p.senseId));
  }

  private patterns(
    test: (row: ContentRows["prepositionPatterns"][number]) => boolean,
  ): PatternHit[] {
    return this.rows.prepositionPatterns
      .filter((p) => test(p) && this.isLiveSense(p.senseId))
      .map((p) => ({
        id: p.id,
        senseId: p.senseId,
        base: p.base,
        preposition: p.preposition,
        pattern: p.pattern,
        complement: p.complement,
        ...(p.note && { note: p.note }),
        ...(p.mistakeId && { mistakeId: p.mistakeId }),
        position: p.position,
      }));
  }

  // ── Context gaps: the same rows as the database repository ───────────────────────────────

  async findGapPatterns(
    bases: readonly string[],
    forms: readonly string[],
  ): Promise<GapPatternHit[]> {
    const byBase = this.patterns((p) => bases.includes(p.baseNormalized)).map((pattern) => ({
      pattern,
    }));
    const byForm = this.rows.forms
      .filter(
        (form) => forms.includes(form.normalized) && this.items.some((i) => i.id === form.itemId),
      )
      .flatMap((form) => {
        const senseIds = this.rows.senses.filter((s) => s.itemId === form.itemId).map((s) => s.id);
        return this.patterns((p) => senseIds.includes(p.senseId)).map((pattern) => ({
          pattern,
          viaForm: form.normalized,
        }));
      });
    return [...byBase, ...byForm];
  }

  async findCollocationTemplates(words: readonly string[]): Promise<CollocationTemplates> {
    if (words.length === 0) return { templates: [], forms: [] };
    const firstWord = (normalized: string) => normalized.split(" ")[0]!;
    const liveItem = (itemId: string) => this.items.some((i) => i.id === itemId);
    // Items with a form starting with one of the words, and every first word of their forms.
    const family = new Set(
      this.rows.forms
        .filter((form) => words.includes(firstWord(form.normalized)) && liveItem(form.itemId))
        .map((form) => form.itemId),
    );
    const heads = new Set(
      this.rows.forms.filter((form) => family.has(form.itemId)).map((f) => firstWord(f.normalized)),
    );
    const wanted = (normalized: string) => {
      const padded = ` ${normalized} `;
      return (
        words.some((w) => padded.includes(` ${w} `) || padded.includes(` ${stem(w)}`)) ||
        heads.has(firstWord(normalized))
      );
    };
    const fromCollocations = this.rows.collocations
      .filter((c) => this.isLiveSense(c.senseId) && wanted(c.normalized))
      .map((c) => ({
        id: c.id,
        senseId: c.senseId,
        ...(c.itemId && { itemId: c.itemId }),
        normalized: c.normalized,
        display: c.phrase,
        ...(c.pattern && { pattern: c.pattern }),
      }));
    const fromForms = this.rows.forms.flatMap((form) => {
      const item = this.items.find((i) => i.id === form.itemId);
      if (!item || (item.kind !== "collocation" && item.kind !== "phrase")) return [];
      if (!wanted(form.normalized)) return [];
      const sense = this.rows.senses
        .filter((s) => s.itemId === item.id && this.isLiveSense(s.id))
        .sort((a, b) => a.position - b.position)[0];
      return sense
        ? [
            {
              id: `form:${item.id}:${form.normalized}`,
              senseId: sense.id,
              itemId: item.id,
              normalized: form.normalized,
              display: form.form,
              base: item.normalized,
            },
          ]
        : [];
    });
    const forms = this.rows.forms
      .filter((form) => family.has(form.itemId))
      .map((form) => ({ itemId: form.itemId, normalized: form.normalized }))
      .sort((a, b) =>
        a.itemId !== b.itemId
          ? a.itemId < b.itemId
            ? -1
            : 1
          : a.normalized < b.normalized
            ? -1
            : 1,
      );
    return { templates: [...fromCollocations, ...fromForms], forms };
  }

  async findPairPatterns(rest: string): Promise<PatternHit[]> {
    const framed = new Set(this.rows.frames.map((frame) => frame.senseId));
    return this.patterns((p) => p.baseNormalized.endsWith(` ${rest}`) || framed.has(p.senseId));
  }

  async listLinkers(): Promise<LinkerHit[]> {
    return this.rows.linkers
      .filter((linker) => this.isLiveSense(linker.senseId))
      .map((linker) => {
        const sense = this.rows.senses.find((s) => s.id === linker.senseId)!;
        const item = this.items.find((i) => i.id === sense.itemId)!;
        return {
          senseId: linker.senseId,
          headword: item.headword,
          positions: linker.positions,
          connects: linker.connects,
          functions: sense.functions ?? [],
        };
      })
      .sort((a, b) => (a.senseId < b.senseId ? -1 : a.senseId > b.senseId ? 1 : 0));
  }

  async findCollocationsByPhrase(normalised: string) {
    return this.collocations((c) => c.normalized === normalised);
  }

  async collocationsOf(senseIds: readonly string[]) {
    return this.collocations((c) => senseIds.includes(c.senseId));
  }

  private collocations(
    test: (row: ContentRows["collocations"][number]) => boolean,
  ): CollocationHit[] {
    return this.rows.collocations
      .filter((c) => test(c) && this.isLiveSense(c.senseId))
      .map((c) => {
        const example = this.rows.examples.find((e) => e.collocationId === c.id);
        const linked = c.itemId
          ? this.rows.senses.find((s) => s.itemId === c.itemId && this.isLiveSense(s.id))
          : undefined;
        return {
          id: c.id,
          senseId: c.senseId,
          phrase: c.phrase,
          ...(c.pattern && { pattern: c.pattern }),
          ...(c.note && { note: c.note }),
          ...(linked && { linkedSenseId: linked.id }),
          ...(example && { example: { text: example.text, highlights: example.highlights } }),
          position: c.position,
        };
      });
  }

  async findMistakes(normalised: string) {
    return this.mistakes(
      (m) =>
        m.wrongNormalized === normalised ||
        (normalised.includes(" ") && ` ${m.wrongNormalized} `.includes(` ${normalised} `)),
    );
  }

  async mistakesOf(senseIds: readonly string[]) {
    return this.mistakes((m) => senseIds.includes(m.senseId));
  }

  private mistakes(test: (row: ContentRows["mistakes"][number]) => boolean): MistakeHit[] {
    return this.rows.mistakes
      .filter((m) => test(m) && this.isLiveSense(m.senseId))
      .map((m) => ({
        id: m.id,
        senseId: m.senseId,
        wrong: m.wrong,
        right: m.right,
        explanation: m.explanation,
        type: m.type,
      }));
  }

  async sensesOfItems(itemIds: readonly string[]): Promise<SenseRef[]> {
    return this.rows.senses
      .filter((s) => itemIds.includes(s.itemId) && this.isLiveSense(s.id))
      .map((s) => ({
        id: s.id,
        itemId: s.itemId,
        position: s.position,
        ...(s.label && { label: s.label }),
        standalone: Boolean(s.standaloneReason),
      }));
  }

  async relationsFrom(
    senseIds: readonly string[],
    types: readonly RelationType[],
  ): Promise<RelationHit[]> {
    return this.rows.relations
      .filter(
        (r) =>
          senseIds.includes(r.fromSenseId) &&
          types.includes(r.type) &&
          this.isLiveSense(r.toSenseId),
      )
      .map((r) => ({
        fromSenseId: r.fromSenseId,
        toSenseId: r.toSenseId,
        type: r.type,
        ...(r.note && { note: r.note }),
        ...(r.contextNote && { contextNote: r.contextNote }),
        weight: r.weight,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  async listIntents(): Promise<IntentDefinition[]> {
    return [...this.rows.intents]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((intent) => ({
        id: intent.id,
        label: intent.label,
        ...(intent.function && { function: intent.function }),
        triggers: this.rows.intentTriggers
          .filter((t) => t.intentId === intent.id)
          .map((t) => t.normalized),
        entries: this.rows.intentEntries
          .filter((e) => e.intentId === intent.id && this.isLiveSense(e.senseId))
          .sort((a, b) => a.position - b.position)
          .map((e) => ({ senseId: e.senseId, group: e.groupLabel, fit: e.fitNote })),
      }));
  }

  async sensesWithFunction(fn: DiscourseFunction, kinds?: readonly ItemKind[]) {
    return this.rows.senses
      .filter((s) => this.isLiveSense(s.id) && (s.functions ?? []).includes(fn))
      .filter(
        (s) => !kinds?.length || kinds.includes(this.items.find((i) => i.id === s.itemId)!.kind),
      )
      .map((s) => s.id);
  }

  async listGapFrames(): Promise<GapFrame[]> {
    return this.rows.frames
      .filter((f) => this.isLiveSense(f.senseId))
      .flatMap((f) => {
        const gap = toGapFrame(f.id, f.senseId, f.display, f.parts as FramePart[]);
        return gap ? [gap] : [];
      });
  }

  // ── Filters and browse: the same rules as the database repository ──────────────────────

  private liveFacets(): (SenseFacets & {
    relevance: number;
    headword: string;
    position: number;
  })[] {
    return this.rows.senses
      .filter((sense) => this.isLiveSense(sense.id))
      .map((sense) => {
        const item = this.items.find((i) => i.id === sense.itemId)!;
        return {
          senseId: sense.id,
          kind: item.kind,
          functions: sense.functions ?? [],
          topics: sense.topics ?? [],
          skills: sense.skills,
          ieltsTasks: sense.ieltsTasks,
          relevance: RELEVANCE_ORDER[sense.ieltsRelevance],
          headword: item.normalized,
          position: sense.position,
        };
      });
  }

  async senseFacets(senseIds: readonly string[]): Promise<SenseFacets[]> {
    const wanted = new Set(senseIds);
    return this.liveFacets()
      .filter((facets) => wanted.has(facets.senseId))
      .map(({ senseId, kind, functions, topics, skills, ieltsTasks }) => ({
        senseId,
        kind,
        functions,
        topics,
        skills,
        ieltsTasks,
      }));
  }

  async browseSenses(filters: SearchFilters, page: { limit: number; offset: number }) {
    const matching = this.liveFacets()
      .filter((facets) => matchesFilters(facets, filters))
      .sort(
        (a, b) =>
          a.relevance - b.relevance ||
          byCodePoint(a.headword, b.headword) ||
          a.position - b.position ||
          byCodePoint(a.senseId, b.senseId),
      );
    return {
      senseIds: matching.slice(page.offset, page.offset + page.limit).map((f) => f.senseId),
      total: matching.length,
    };
  }

  async filterCounts(filters: SearchFilters): Promise<FilterCounts> {
    const counts: FilterCounts = { kind: {}, function: {}, use: {}, topic: {} };
    const live = this.liveFacets();
    for (const dimension of FILTER_DIMENSIONS) {
      const others = { ...filters, [dimension]: undefined };
      const pool = live.filter((facets) => matchesFilters(facets, others));
      for (const value of FILTER_VALUES[dimension]) {
        const n = pool.filter((facets) => hasValue(facets, dimension, value)).length;
        if (n > 0) counts[dimension][value] = n;
      }
    }
    return counts;
  }

  async fullText(normalised: string) {
    const words = normalised.split(" ").filter((w) => w.length > 3);
    return this.rows.senses
      .filter((s) => this.isLiveSense(s.id))
      .filter((s) => words.some((w) => `${s.definition} ${s.bestWhen}`.toLowerCase().includes(w)))
      .map((s) => s.id);
  }
}

/** The database enum order of `ielts_relevance`. */
const RELEVANCE_ORDER = { core: 0, high: 1, useful: 2 } as const;

/** Code-point order, like PostgreSQL's `collate "C"`. */
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function similar(terms: string[], normalised: string) {
  return [...new Set(terms)]
    .filter((term) => trigramSimilarity(term, normalised) >= SIMILARITY)
    .sort();
}

function hasValue(facets: FilterFacets, dimension: keyof SearchFilters, value: string) {
  if (dimension === "kind") return facets.kind === value;
  if (dimension === "function") return (facets.functions as readonly string[]).includes(value);
  if (dimension === "topic") return (facets.topics as readonly string[]).includes(value);
  return matchesUse(facets, value as Parameters<typeof matchesUse>[1]);
}
