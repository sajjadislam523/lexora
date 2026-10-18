import "server-only";

import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { LanguageContentRepository } from "@/language/engine";
import {
  FILTER_DIMENSIONS,
  type FilterDimension,
  type IeltsUse,
  type SearchFilters,
} from "@/language/filters";
import { toGapFrame } from "@/language/search/match";
import { stem } from "@/language/search/text";
import type {
  CollocationHit,
  CollocationTemplate,
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
import type { DiscourseFunction, ItemKind, RelationType } from "@/language/schema/vocabulary";
import type {
  FramePart,
  LanguageDetail,
  RelatedSense,
  Sense,
  SenseSummary,
  SlugRedirect,
} from "@/language/model";
import type { Database } from "@/server/db/connect";
import {
  collocations,
  contentSources,
  examples,
  frames,
  intentEntries,
  intents,
  intentTriggers,
  itemForms,
  itemSlugHistory,
  languageItems,
  linkerDetails,
  mistakes,
  prepositionPatterns,
  senseRelations,
  senses,
} from "@/server/db/schema";

/**
 * The language tables, read-only, published content only, for pages and for search. Never imports auth or user data:
 * the same results serve every visitor (docs/ARCHITECTURE.md → Language engine).
 */
export class DatabaseLanguageRepository
  implements LanguageContentRepository, LanguageSearchRepository
{
  constructor(private readonly db: Database) {}

  async getItemBySlug(slug: string): Promise<LanguageDetail | SlugRedirect | null> {
    const [item] = await this.db
      .select()
      .from(languageItems)
      .where(eq(languageItems.slug, slug))
      .limit(1);
    if (item) {
      if (item.status === "published") return this.loadDetail(item);
      return this.redirectFor(item);
    }

    const [moved] = await this.db
      .select({ item: languageItems })
      .from(itemSlugHistory)
      .innerJoin(languageItems, eq(languageItems.id, itemSlugHistory.itemId))
      .where(eq(itemSlugHistory.slug, slug))
      .limit(1);
    if (!moved) return null;
    if (moved.item.status === "published") return { redirectTo: moved.item.slug };
    return this.redirectFor(moved.item);
  }

  async listPublishedSlugs(): Promise<string[]> {
    const rows = await this.db
      .select({ slug: languageItems.slug })
      .from(languageItems)
      .where(eq(languageItems.status, "published"))
      .orderBy(asc(languageItems.slug));
    return rows.map((row) => row.slug);
  }

  async getSenseSummaries(senseIds: readonly string[]): Promise<SenseSummary[]> {
    if (senseIds.length === 0) return [];
    const rows = await this.db
      .select({ sense: senses, item: languageItems })
      .from(senses)
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(
        and(
          inArray(senses.id, [...senseIds]),
          eq(senses.status, "published"),
          eq(languageItems.status, "published"),
        ),
      );
    const ids = rows.map((row) => row.sense.id);
    const [exampleRows, collocationRows, patternRows] = await Promise.all([
      this.examplesOf(ids),
      this.collocationsWithItems(ids),
      this.patternRowsOf(ids),
    ]);

    const byId = new Map(
      rows.map(({ sense, item }) => {
        const example = exampleRows.find((row) => row.senseId === sense.id);
        const pattern = patternRows.find((row) => row.senseId === sense.id);
        const summary: SenseSummary = {
          senseId: sense.id,
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
          collocations: collocationRows
            .filter((row) => row.senseId === sense.id)
            .slice(0, 4)
            .map((row) => row.phrase),
          ...(pattern && { pattern: pattern.pattern }),
        };
        return [sense.id, summary] as const;
      }),
    );
    return senseIds.flatMap((id) => byId.get(id) ?? []);
  }

  // ── Search lookups (LanguageSearchRepository) ──────────────────────────────────────────

  async findForms(normalised: string): Promise<FormMatch[]> {
    return this.findFormsIn([normalised]);
  }

  async findFormsIn(phrases: readonly string[]): Promise<FormMatch[]> {
    if (phrases.length === 0) return [];
    const rows = await this.db
      .select({ form: itemForms, item: languageItems })
      .from(itemForms)
      .innerJoin(languageItems, eq(languageItems.id, itemForms.itemId))
      .where(and(inArray(itemForms.normalized, [...phrases]), published(languageItems)))
      .orderBy(desc(itemForms.isDefault), asc(languageItems.id), asc(itemForms.id));
    return rows.map(({ form, item }) => ({
      itemId: item.id,
      slug: item.slug,
      headword: item.headword,
      kind: item.kind,
      form: form.normalized,
      formType: form.formType,
      ...(form.region && { region: form.region }),
      isDefault: form.isDefault,
    }));
  }

  async findTermCandidates(normalised: string): Promise<string[]> {
    const rows = await this.db.execute<{ term: string }>(sql`
      select f.normalized as term from item_forms f
        join language_items i on i.id = f.item_id and i.status = 'published'
        where f.normalized % ${normalised}
      union
      select c.normalized from collocations c
        join senses s on s.id = c.sense_id and s.status = 'published'
        join language_items i on i.id = s.item_id and i.status = 'published'
        where c.normalized % ${normalised}
      union
      select p.base_normalized from preposition_patterns p
        join senses s on s.id = p.sense_id and s.status = 'published'
        join language_items i on i.id = s.item_id and i.status = 'published'
        where p.base_normalized % ${normalised}
      order by 1
    `);
    return rows.map((row) => row.term);
  }

  async findPatternBaseCandidates(normalised: string): Promise<string[]> {
    const rows = await this.db.execute<{ term: string }>(sql`
      select distinct p.base_normalized as term from preposition_patterns p
        join senses s on s.id = p.sense_id and s.status = 'published'
        join language_items i on i.id = s.item_id and i.status = 'published'
        where p.base_normalized % ${normalised}
      order by 1
    `);
    return rows.map((row) => row.term);
  }

  async findPatternsByBase(normalised: string): Promise<PatternHit[]> {
    return this.patternsWhere(eq(prepositionPatterns.baseNormalized, normalised));
  }

  async patternsOf(senseIds: readonly string[]): Promise<PatternHit[]> {
    if (senseIds.length === 0) return [];
    return this.patternsWhere(inArray(prepositionPatterns.senseId, [...senseIds]));
  }

  async findCollocationsByPhrase(normalised: string): Promise<CollocationHit[]> {
    return this.collocationsWhere(eq(collocations.normalized, normalised));
  }

  async collocationsOf(senseIds: readonly string[]): Promise<CollocationHit[]> {
    if (senseIds.length === 0) return [];
    return this.collocationsWhere(inArray(collocations.senseId, [...senseIds]));
  }

  async findMistakes(normalised: string): Promise<MistakeHit[]> {
    // A one-word query only matches a whole mistake; longer ones also match inside sentences.
    const contains = normalised.includes(" ")
      ? sql`(' ' || ${mistakes.wrongNormalized} || ' ') like ${`% ${escapeLike(normalised)} %`}`
      : sql`false`;
    return this.mistakesWhere(or(eq(mistakes.wrongNormalized, normalised), contains)!);
  }

  async mistakesOf(senseIds: readonly string[]): Promise<MistakeHit[]> {
    if (senseIds.length === 0) return [];
    return this.mistakesWhere(inArray(mistakes.senseId, [...senseIds]));
  }

  async sensesOfItems(itemIds: readonly string[]): Promise<SenseRef[]> {
    if (itemIds.length === 0) return [];
    const rows = await this.db
      .select({ sense: senses })
      .from(senses)
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(
        and(
          inArray(senses.itemId, [...itemIds]),
          eq(senses.status, "published"),
          published(languageItems),
        ),
      )
      .orderBy(asc(senses.itemId), asc(senses.position));
    return rows.map(({ sense }) => ({
      id: sense.id,
      itemId: sense.itemId,
      position: sense.position,
      ...(sense.label && { label: sense.label }),
      standalone: sense.standaloneReason !== null,
    }));
  }

  async relationsFrom(
    senseIds: readonly string[],
    types: readonly RelationType[],
  ): Promise<RelationHit[]> {
    if (senseIds.length === 0 || types.length === 0) return [];
    const target = alias(senses, "target");
    const rows = await this.db
      .select({ relation: senseRelations })
      .from(senseRelations)
      .innerJoin(target, eq(target.id, senseRelations.toSenseId))
      .innerJoin(languageItems, eq(languageItems.id, target.itemId))
      .where(
        and(
          inArray(senseRelations.fromSenseId, [...senseIds]),
          inArray(senseRelations.type, [...types]),
          eq(target.status, "published"),
          published(languageItems),
        ),
      )
      .orderBy(desc(senseRelations.weight), asc(languageItems.headword));
    return rows.map(({ relation }) => ({
      fromSenseId: relation.fromSenseId,
      toSenseId: relation.toSenseId,
      type: relation.type,
      ...(relation.note && { note: relation.note }),
      ...(relation.contextNote && { contextNote: relation.contextNote }),
      weight: relation.weight,
    }));
  }

  async listIntents(): Promise<IntentDefinition[]> {
    const [intentRows, triggerRows, entryRows] = await Promise.all([
      this.db.select().from(intents).orderBy(asc(intents.id)),
      this.db.select().from(intentTriggers).orderBy(asc(intentTriggers.normalized)),
      this.db
        .select({ entry: intentEntries })
        .from(intentEntries)
        .innerJoin(senses, eq(senses.id, intentEntries.senseId))
        .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
        .where(and(eq(senses.status, "published"), published(languageItems)))
        .orderBy(asc(intentEntries.intentId), asc(intentEntries.position)),
    ]);
    return intentRows.map((intent) => ({
      id: intent.id,
      label: intent.label,
      ...(intent.function && { function: intent.function }),
      triggers: triggerRows.filter((t) => t.intentId === intent.id).map((t) => t.normalized),
      entries: entryRows
        .filter(({ entry }) => entry.intentId === intent.id)
        .map(({ entry }) => ({
          senseId: entry.senseId,
          group: entry.groupLabel,
          fit: entry.fitNote,
        })),
    }));
  }

  async sensesWithFunction(fn: DiscourseFunction, kinds?: readonly ItemKind[]): Promise<string[]> {
    const rows = await this.db
      .select({ id: senses.id })
      .from(senses)
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(
        and(
          sql`${fn} = any(${senses.functions})`,
          eq(senses.status, "published"),
          published(languageItems),
          kinds?.length ? inArray(languageItems.kind, [...kinds]) : undefined,
        ),
      )
      .orderBy(asc(languageItems.headword), asc(senses.position));
    return rows.map((row) => row.id);
  }

  async listGapFrames(): Promise<GapFrame[]> {
    const rows = await this.db
      .select({ frame: frames })
      .from(frames)
      .innerJoin(senses, eq(senses.id, frames.senseId))
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(and(eq(senses.status, "published"), published(languageItems)))
      .orderBy(asc(frames.id));
    return rows.flatMap(({ frame }) => {
      const gap = toGapFrame(frame.senseId, frame.display, frame.parts as FramePart[]);
      return gap ? [gap] : [];
    });
  }

  async fullText(normalised: string): Promise<string[]> {
    const rows = await this.db.execute<{ id: string }>(sql`
      select s.id from senses s
        join language_items i on i.id = s.item_id and i.status = 'published'
        where s.status = 'published' and s.search_vector @@ plainto_tsquery('english', ${normalised})
        order by ts_rank(s.search_vector, plainto_tsquery('english', ${normalised})) desc, s.id
        limit 10
    `);
    return rows.map((row) => row.id);
  }

  // ── Context gaps (Phase 4 Step 4.2) ──────────────────────────────────────────────────────

  async findGapPatterns(
    bases: readonly string[],
    forms: readonly string[],
  ): Promise<GapPatternHit[]> {
    const [byBase, byForm] = await Promise.all([
      bases.length > 0
        ? this.patternsWhere(inArray(prepositionPatterns.baseNormalized, [...bases]))
        : Promise.resolve([]),
      forms.length > 0
        ? this.db
            .select({ pattern: prepositionPatterns, form: itemForms.normalized })
            .from(prepositionPatterns)
            .innerJoin(senses, eq(senses.id, prepositionPatterns.senseId))
            .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
            .innerJoin(itemForms, eq(itemForms.itemId, languageItems.id))
            .where(
              and(
                inArray(itemForms.normalized, [...forms]),
                eq(senses.status, "published"),
                published(languageItems),
              ),
            )
            .orderBy(
              asc(languageItems.headword),
              asc(senses.position),
              asc(prepositionPatterns.position),
              asc(itemForms.normalized),
            )
        : Promise.resolve([]),
    ]);
    return [
      ...byBase.map((pattern) => ({ pattern })),
      ...byForm.map(({ pattern, form }) => ({
        pattern: {
          id: pattern.id,
          senseId: pattern.senseId,
          base: pattern.base,
          preposition: pattern.preposition,
          pattern: pattern.pattern,
          complement: pattern.complement,
          ...(pattern.note && { note: pattern.note }),
          ...(pattern.mistakeId && { mistakeId: pattern.mistakeId }),
          position: pattern.position,
        },
        viaForm: form,
      })),
    ];
  }

  async findCollocationTemplates(words: readonly string[]): Promise<CollocationTemplate[]> {
    if (words.length === 0) return [];
    // A word or its stem as a whole-word prefix; the exact alignment happens in the engine.
    const likes = [
      ...new Set(words.flatMap((w) => [`% ${escapeLike(w)} %`, `% ${escapeLike(stem(w))}%`])),
    ];
    const any = sql`any(array[${sql.join(
      likes.map((like) => sql`${like}`),
      sql`, `,
    )}]::text[])`;
    const [fromCollocations, fromForms] = await Promise.all([
      this.db.execute<{
        id: string;
        sense_id: string;
        item_id: string | null;
        normalized: string;
        display: string;
      }>(sql`
        select c.id, c.sense_id, c.item_id, c.normalized, c.phrase as display from collocations c
          join senses s on s.id = c.sense_id and s.status = 'published'
          join language_items i on i.id = s.item_id and i.status = 'published'
          where (' ' || c.normalized || ' ') like ${any}
          order by c.id
      `),
      this.db.execute<{
        item_id: string;
        sense_id: string;
        normalized: string;
        display: string;
      }>(sql`
        select f.item_id, f.normalized, f.form as display,
            (select s.id from senses s where s.item_id = i.id and s.status = 'published'
              order by s.position limit 1) as sense_id
          from item_forms f
          join language_items i on i.id = f.item_id and i.status = 'published'
          where i.kind in ('collocation', 'phrase') and (' ' || f.normalized || ' ') like ${any}
          order by f.item_id, f.normalized
      `),
    ]);
    return [
      ...fromCollocations.map((row) => ({
        id: row.id,
        senseId: row.sense_id,
        ...(row.item_id && { itemId: row.item_id }),
        normalized: row.normalized,
        display: row.display,
      })),
      ...fromForms.flatMap((row) =>
        row.sense_id
          ? [
              {
                id: `form:${row.item_id}:${row.normalized}`,
                senseId: row.sense_id,
                itemId: row.item_id,
                normalized: row.normalized,
                display: row.display,
              },
            ]
          : [],
      ),
    ];
  }

  async listLinkers(): Promise<LinkerHit[]> {
    const rows = await this.db
      .select({
        senseId: linkerDetails.senseId,
        headword: languageItems.headword,
        positions: linkerDetails.positions,
        connects: linkerDetails.connects,
        functions: senses.functions,
      })
      .from(linkerDetails)
      .innerJoin(senses, eq(senses.id, linkerDetails.senseId))
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(and(eq(senses.status, "published"), published(languageItems)))
      .orderBy(asc(linkerDetails.senseId));
    return rows;
  }

  // ── Filters and browse (Phase 4) ─────────────────────────────────────────────────────────

  async senseFacets(senseIds: readonly string[]): Promise<SenseFacets[]> {
    if (senseIds.length === 0) return [];
    const rows = await this.db
      .select({
        senseId: senses.id,
        kind: languageItems.kind,
        functions: senses.functions,
        topics: senses.topics,
        skills: senses.skills,
        ieltsTasks: senses.ieltsTasks,
      })
      .from(senses)
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(
        and(
          inArray(senses.id, [...new Set(senseIds)]),
          eq(senses.status, "published"),
          published(languageItems),
        ),
      );
    return rows;
  }

  async browseSenses(
    filters: SearchFilters,
    page: { limit: number; offset: number },
  ): Promise<{ senseIds: string[]; total: number }> {
    const where = and(livePublished(), ...filterConditions(filters));
    const [rows, [count]] = await Promise.all([
      this.db
        .select({ id: senses.id })
        .from(senses)
        .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
        .where(where)
        .orderBy(
          asc(senses.ieltsRelevance),
          sql`${languageItems.normalized} collate "C"`,
          asc(senses.position),
          asc(senses.id),
        )
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(senses)
        .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
        .where(where),
    ]);
    return { senseIds: rows.map((row) => row.id), total: count?.total ?? 0 };
  }

  async filterCounts(filters: SearchFilters): Promise<FilterCounts> {
    // One statement: per dimension, the values of the senses that match the other filters.
    const others = (dimension: FilterDimension) =>
      and(livePublished(), ...filterConditions({ ...filters, [dimension]: undefined }));
    const rows = await this.db.execute<{
      dimension: FilterDimension;
      value: string;
      n: number;
    }>(sql`
      select 'kind' as dimension, language_items.kind::text as value, count(*)::int as n
        from senses join language_items on language_items.id = senses.item_id
        where ${others("kind")} group by 2
      union all
      select 'function', f::text, count(*)::int
        from senses join language_items on language_items.id = senses.item_id,
          unnest(senses.functions) f
        where ${others("function")} group by 2
      union all
      select 'use', u, count(*)::int
        from senses join language_items on language_items.id = senses.item_id,
          unnest(senses.skills::text[] || senses.ielts_tasks::text[]) u
        where ${others("use")} group by 2
      union all
      select 'topic', t::text, count(*)::int
        from senses join language_items on language_items.id = senses.item_id,
          unnest(senses.topics) t
        where ${others("topic")} group by 2
    `);
    const counts: FilterCounts = { kind: {}, function: {}, use: {}, topic: {} };
    for (const row of rows) counts[row.dimension][row.value] = row.n;
    return counts;
  }

  private async patternsWhere(condition: SQL): Promise<PatternHit[]> {
    const rows = await this.db
      .select({ pattern: prepositionPatterns })
      .from(prepositionPatterns)
      .innerJoin(senses, eq(senses.id, prepositionPatterns.senseId))
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(and(condition, eq(senses.status, "published"), published(languageItems)))
      .orderBy(
        asc(languageItems.headword),
        asc(senses.position),
        asc(prepositionPatterns.position),
      );
    return rows.map(({ pattern }) => ({
      id: pattern.id,
      senseId: pattern.senseId,
      base: pattern.base,
      preposition: pattern.preposition,
      pattern: pattern.pattern,
      complement: pattern.complement,
      ...(pattern.note && { note: pattern.note }),
      ...(pattern.mistakeId && { mistakeId: pattern.mistakeId }),
      position: pattern.position,
    }));
  }

  private async collocationsWhere(condition: SQL): Promise<CollocationHit[]> {
    const rows = await this.db
      .select({ collocation: collocations })
      .from(collocations)
      .innerJoin(senses, eq(senses.id, collocations.senseId))
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(and(condition, eq(senses.status, "published"), published(languageItems)))
      .orderBy(asc(collocations.senseId), asc(collocations.position));
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.collocation.id);
    const linkedItems = rows.flatMap((row) =>
      row.collocation.itemId ? [row.collocation.itemId] : [],
    );
    const [exampleRows, linkedSenses] = await Promise.all([
      this.db
        .select()
        .from(examples)
        .where(inArray(examples.collocationId, ids))
        .orderBy(asc(examples.position)),
      linkedItems.length ? this.sensesOfItems(linkedItems) : Promise.resolve([] as SenseRef[]),
    ]);
    return rows.map(({ collocation }) => {
      const example = exampleRows.find((row) => row.collocationId === collocation.id);
      const linked = linkedSenses.find((sense) => sense.itemId === collocation.itemId);
      return {
        id: collocation.id,
        senseId: collocation.senseId,
        phrase: collocation.phrase,
        ...(collocation.pattern && { pattern: collocation.pattern }),
        ...(collocation.note && { note: collocation.note }),
        ...(linked && { linkedSenseId: linked.id }),
        ...(example && { example: { text: example.text, highlights: example.highlights } }),
        position: collocation.position,
      };
    });
  }

  private async mistakesWhere(condition: SQL): Promise<MistakeHit[]> {
    const rows = await this.db
      .select({ mistake: mistakes })
      .from(mistakes)
      .innerJoin(senses, eq(senses.id, mistakes.senseId))
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(and(condition, eq(senses.status, "published"), published(languageItems)))
      .orderBy(asc(mistakes.senseId), asc(mistakes.position));
    return rows.map(({ mistake }) => ({
      id: mistake.id,
      senseId: mistake.senseId,
      wrong: mistake.wrong,
      right: mistake.right,
      explanation: mistake.explanation,
      type: mistake.type,
    }));
  }

  // ── Internals ────────────────────────────────────────────────────────────────────────────

  /** Retired items with a published replacement redirect there; anything else is not found. */
  private async redirectFor(item: typeof languageItems.$inferSelect): Promise<SlugRedirect | null> {
    if (item.status !== "retired" || !item.replacedBy) return null;
    const [replacement] = await this.db
      .select({ slug: languageItems.slug, status: languageItems.status })
      .from(languageItems)
      .where(eq(languageItems.id, item.replacedBy))
      .limit(1);
    return replacement?.status === "published" ? { redirectTo: replacement.slug } : null;
  }

  private async loadDetail(item: typeof languageItems.$inferSelect): Promise<LanguageDetail> {
    const [senseRows, formRows, [source]] = await Promise.all([
      this.db
        .select()
        .from(senses)
        .where(and(eq(senses.itemId, item.id), eq(senses.status, "published")))
        .orderBy(asc(senses.position)),
      this.db
        .select()
        .from(itemForms)
        .where(eq(itemForms.itemId, item.id))
        .orderBy(desc(itemForms.isDefault), asc(itemForms.id)),
      this.db
        .select({ name: contentSources.name, attribution: contentSources.attribution })
        .from(contentSources)
        .where(eq(contentSources.id, item.sourceId)),
    ]);

    const ids = senseRows.map((sense) => sense.id);
    const [exampleRows, collocationRows, patternRows, frameRows, mistakeRows, linkerRows, related] =
      await Promise.all([
        this.examplesOf(ids),
        this.collocationsWithItems(ids),
        this.patternRowsOf(ids),
        this.framesOf(ids),
        this.mistakeRowsOf(ids),
        ids.length
          ? this.db.select().from(linkerDetails).where(inArray(linkerDetails.senseId, ids))
          : Promise.resolve([]),
        this.relatedTo(ids),
      ]);

    const local = (id: string | null) => (id ? id.slice(id.indexOf(":") + 1) : undefined);

    const detailSenses = senseRows.map((sense): Sense => {
      const of = <T extends { senseId: string }>(rows: T[]) =>
        rows.filter((row) => row.senseId === sense.id);
      const linker = linkerRows.find((row) => row.senseId === sense.id);
      return {
        id: sense.id,
        ...(sense.label && { label: sense.label }),
        partOfSpeech: sense.partOfSpeech,
        definition: sense.definition,
        cefr: sense.cefr,
        registers: sense.registers,
        skills: sense.skills,
        ieltsRelevance: sense.ieltsRelevance,
        ieltsTasks: sense.ieltsTasks,
        ...(sense.strength && { strength: sense.strength as 1 | 2 | 3 }),
        functions: sense.functions,
        bestWhen: sense.bestWhen,
        ...(sense.avoidWhen && { avoidWhen: sense.avoidWhen }),
        ...(sense.skillNote && { skillNote: sense.skillNote }),
        ...(linker && {
          linker: {
            connects: linker.connects,
            positions: linker.positions,
            punctuation: linker.punctuation,
          },
        }),
        examples: of(exampleRows).map((row) => ({
          id: row.id,
          text: row.text,
          highlights: row.highlights,
          skill: row.skill,
          ...(row.ieltsTask && { task: row.ieltsTask }),
          ...(row.collocationId && { collocationId: local(row.collocationId) }),
          ...(row.prepositionPatternId && {
            prepositionPatternId: local(row.prepositionPatternId),
          }),
        })),
        collocations: of(collocationRows).map((row) => ({
          id: local(row.id)!,
          phrase: row.phrase,
          ...(row.pattern && { pattern: row.pattern }),
          ...(row.note && { note: row.note }),
          ...(row.itemSlug && { itemSlug: row.itemSlug }),
        })),
        prepositionPatterns: of(patternRows).map((row) => ({
          id: local(row.id)!,
          base: row.base,
          preposition: row.preposition,
          pattern: row.pattern,
          complement: row.complement,
          ...(row.note && { note: row.note }),
        })),
        frames: of(frameRows).map((row) => ({
          id: local(row.id)!,
          display: row.display,
          parts: row.parts as FramePart[],
        })),
        mistakes: of(mistakeRows).map((row) => ({
          id: local(row.id)!,
          wrong: row.wrong,
          right: row.right,
          explanation: row.explanation,
          type: row.type,
        })),
        relations: related
          .filter((row) => row.fromSenseId === sense.id)
          .map(({ fromSenseId: _, ...r }) => r),
      };
    });

    return {
      id: item.id,
      slug: item.slug,
      kind: item.kind,
      headword: item.headword,
      forms: formRows.map((row) => ({
        form: row.form,
        type: row.formType,
        ...(row.region && { region: row.region }),
      })),
      ...(item.regionalNote && { regionalNote: item.regionalNote }),
      senses: detailSenses,
      source: {
        name: source?.name ?? "",
        ...(source?.attribution && { attribution: source.attribution }),
      },
    };
  }

  // Child rows of several senses, in authored order. Callers group them by sense.
  private examplesOf(senseIds: string[]) {
    return senseIds.length === 0
      ? Promise.resolve([])
      : this.db
          .select()
          .from(examples)
          .where(inArray(examples.senseId, senseIds))
          .orderBy(asc(examples.position));
  }

  private patternRowsOf(senseIds: string[]) {
    return senseIds.length === 0
      ? Promise.resolve([])
      : this.db
          .select()
          .from(prepositionPatterns)
          .where(inArray(prepositionPatterns.senseId, senseIds))
          .orderBy(asc(prepositionPatterns.position));
  }

  private framesOf(senseIds: string[]) {
    return senseIds.length === 0
      ? Promise.resolve([])
      : this.db
          .select()
          .from(frames)
          .where(inArray(frames.senseId, senseIds))
          .orderBy(asc(frames.position));
  }

  private mistakeRowsOf(senseIds: string[]) {
    return senseIds.length === 0
      ? Promise.resolve([])
      : this.db
          .select()
          .from(mistakes)
          .where(inArray(mistakes.senseId, senseIds))
          .orderBy(asc(mistakes.position));
  }

  /** Collocations, with the slug of their full item when that item is published. */
  private async collocationsWithItems(senseIds: string[]) {
    if (senseIds.length === 0) return [];
    const rows = await this.db
      .select({ collocation: collocations, slug: languageItems.slug, status: languageItems.status })
      .from(collocations)
      .leftJoin(languageItems, eq(languageItems.id, collocations.itemId))
      .where(inArray(collocations.senseId, senseIds))
      .orderBy(asc(collocations.senseId), asc(collocations.position));
    return rows.map((row) => ({
      ...row.collocation,
      itemSlug: row.status === "published" ? row.slug : null,
    }));
  }

  /** Relations from these senses to published senses of published items. */
  private async relatedTo(senseIds: string[]): Promise<(RelatedSense & { fromSenseId: string })[]> {
    if (senseIds.length === 0) return [];
    const target = alias(senses, "target");
    const rows = await this.db
      .select({ relation: senseRelations, target, item: languageItems })
      .from(senseRelations)
      .innerJoin(target, eq(target.id, senseRelations.toSenseId))
      .innerJoin(languageItems, eq(languageItems.id, target.itemId))
      .where(
        and(
          inArray(senseRelations.fromSenseId, senseIds),
          eq(target.status, "published"),
          eq(languageItems.status, "published"),
        ),
      )
      .orderBy(desc(senseRelations.weight), asc(languageItems.headword), asc(target.position));
    return rows.map(({ relation, target, item }) => ({
      fromSenseId: relation.fromSenseId,
      type: relation.type,
      senseId: target.id,
      slug: item.slug,
      headword: item.headword,
      ...(target.label && { senseLabel: target.label }),
      definition: target.definition,
      ...(relation.note && { note: relation.note }),
      ...(relation.contextNote && { contextNote: relation.contextNote }),
      weight: relation.weight,
    }));
  }
}

function published(table: typeof languageItems) {
  return eq(table.status, "published");
}

/** Published senses of published items: the rows browsing and counting start from. */
function livePublished() {
  return and(eq(senses.status, "published"), published(languageItems));
}

/**
 * SQL conditions for validated filters (src/language/filters.ts). Values are bound parameters;
 * the column a value is compared with is fixed by its dimension.
 */
function filterConditions(filters: SearchFilters): SQL[] {
  const conditions: SQL[] = [];
  for (const dimension of FILTER_DIMENSIONS) {
    const value = filters[dimension];
    if (value === undefined) continue;
    if (dimension === "kind") conditions.push(sql`${languageItems.kind} = ${value}`);
    if (dimension === "function") conditions.push(sql`${value} = any(${senses.functions})`);
    if (dimension === "topic") conditions.push(sql`${value} = any(${senses.topics})`);
    if (dimension === "use") conditions.push(ieltsUseCondition(value as IeltsUse));
  }
  return conditions;
}

function ieltsUseCondition(use: IeltsUse): SQL {
  return use === "writing" || use === "speaking"
    ? sql`${use} = any(${senses.skills})`
    : sql`${use} = any(${senses.ieltsTasks})`;
}

function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
