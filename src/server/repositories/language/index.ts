import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { LanguageContentRepository } from "@/language/engine";
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
 * The language tables, read-only, published content only. Never imports auth or user data:
 * the same results serve every visitor (docs/ARCHITECTURE.md → Language engine).
 */
export class DatabaseLanguageRepository implements LanguageContentRepository {
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
      this.patternsOf(ids),
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
        this.patternsOf(ids),
        this.framesOf(ids),
        this.mistakesOf(ids),
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

  private patternsOf(senseIds: string[]) {
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

  private mistakesOf(senseIds: string[]) {
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
