import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { PracticeMaterial } from "@/learning/exercises";
import { assemblePracticeMaterial } from "@/server/content/practice";
import type { Database } from "@/server/db/client";
import { examples, languageItems, mistakes, prepositionPatterns, senses } from "@/server/db/schema";

/**
 * The practice material of these senses (src/learning/exercises.ts), read from the imported
 * language tables: four statements whatever the number of senses. Only published senses of
 * published items; others (and unknown IDs) are left out. Language data only, no user data.
 */
export async function loadPracticeMaterial(
  db: Database,
  senseIds: readonly string[],
): Promise<PracticeMaterial[]> {
  if (senseIds.length === 0) return [];
  const ids = [...new Set(senseIds)];
  const [senseRows, exampleRows, patternRows, mistakeRows] = await Promise.all([
    db
      .select({
        id: senses.id,
        itemId: senses.itemId,
        label: senses.label,
        definition: senses.definition,
        position: senses.position,
        status: senses.status,
        kind: languageItems.kind,
        headword: languageItems.headword,
        itemStatus: languageItems.status,
        forms: sql<
          string[]
        >`coalesce((select array_agg(f.form) from item_forms f where f.item_id = ${senses.itemId}), '{}')`,
        liveSenses: sql<number>`(select count(*)::int from senses s2 where s2.item_id = ${senses.itemId} and s2.status = 'published')`,
      })
      .from(senses)
      .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
      .where(
        and(
          inArray(senses.id, ids),
          eq(senses.status, "published"),
          eq(languageItems.status, "published"),
        ),
      ),
    db.select().from(examples).where(inArray(examples.senseId, ids)),
    db.select().from(prepositionPatterns).where(inArray(prepositionPatterns.senseId, ids)),
    db.select().from(mistakes).where(inArray(mistakes.senseId, ids)),
  ]);

  return assemblePracticeMaterial(
    {
      items: senseRows.map((r) => ({
        id: r.itemId,
        kind: r.kind,
        headword: r.headword,
        status: r.itemStatus,
      })),
      liveSensesPerItem: new Map(senseRows.map((r) => [r.itemId, r.liveSenses])),
      senses: senseRows,
      // One list per item, however many of its senses were asked for.
      forms: [...new Map(senseRows.map((r) => [r.itemId, r.forms])).entries()].flatMap(
        ([itemId, forms]) => forms.map((form) => ({ itemId, form })),
      ),
      examples: exampleRows,
      patterns: patternRows,
      mistakes: mistakeRows,
    },
    senseIds,
  );
}
