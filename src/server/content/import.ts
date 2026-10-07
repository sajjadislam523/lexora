import "server-only";

import {
  desc,
  getTableColumns,
  getTableName,
  inArray,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { Database } from "@/server/db/connect";
import * as schema from "@/server/db/schema";

import { buildRows, contentChecksum, type ContentRows } from "./build";
import type { ValidatedContent } from "./validate";

/**
 * Imports validated content into PostgreSQL in one transaction (content/README.md → Importing):
 *
 * 1. Lock, so two imports can't interleave, and stop if the content is unchanged since the last
 *    release (same checksum): running an import twice changes nothing.
 * 2. Refuse unsafe changes: a published or retired item or sense missing from the content,
 *    published content returned to draft, or a slug change without the old slug kept.
 * 3. Upsert sources, items, forms, senses and keyed child rows by their authored IDs. Rows whose
 *    values didn't change aren't touched.
 * 4. Delete child rows (examples, collocations, patterns, frames, mistakes, relations, triggers,
 *    entries) that are no longer authored. Items and senses are never deleted, except drafts that
 *    were never published.
 * 5. Write inverse relations, rebuild the search vectors, and record a release.
 */

export type ImportResult = {
  status: "imported" | "unchanged";
  checksum: string;
  releaseId?: number;
  counts: Record<string, number>;
};

export class UnsafeImportError extends Error {
  constructor(readonly problems: string[]) {
    super(`Refusing to import:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "UnsafeImportError";
  }
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function importContent(
  db: Database,
  content: ValidatedContent,
  options: { gitSha?: string; force?: boolean } = {},
): Promise<ImportResult> {
  const checksum = contentChecksum(content);
  const rows = buildRows(content);
  const counts = countRows(content, rows);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('lexora:content-import'))`);

    const [latest] = await tx
      .select({ checksum: schema.contentReleases.checksum })
      .from(schema.contentReleases)
      .orderBy(desc(schema.contentReleases.id))
      .limit(1);
    if (!options.force && latest?.checksum === checksum) {
      return { status: "unchanged", checksum, counts };
    }

    const removedDrafts = await checkSafety(tx, rows);
    await removeDrafts(tx, removedDrafts);
    await write(tx, rows);

    const [release] = await tx
      .insert(schema.contentReleases)
      .values({ checksum, gitSha: options.gitSha ?? null, counts })
      .returning({ id: schema.contentReleases.id });
    await tx
      .update(schema.languageItems)
      .set({ releaseId: release!.id })
      .where(sql`${schema.languageItems.releaseId} is null`);

    return { status: "imported", checksum, releaseId: release!.id, counts };
  });
}

// ── Safety checks ──────────────────────────────────────────────────────────────────────────

/** Returns the drafts (items and senses) that may be removed; throws on anything unsafe. */
async function checkSafety(tx: Transaction, rows: ContentRows) {
  const problems: string[] = [];
  const items = new Map(rows.items.map((item) => [item.id, item]));
  const senses = new Set(rows.senses.map((sense) => sense.id));
  const previousSlugs = new Map<string, Set<string>>();
  for (const { itemId, slug } of rows.slugHistory) {
    previousSlugs.set(itemId, (previousSlugs.get(itemId) ?? new Set()).add(slug));
  }

  const existingItems = await tx
    .select({
      id: schema.languageItems.id,
      slug: schema.languageItems.slug,
      status: schema.languageItems.status,
    })
    .from(schema.languageItems);
  const existingStatus = new Map(existingItems.map((item) => [item.id, item.status]));
  const draftItems: string[] = [];

  for (const existing of existingItems) {
    const next = items.get(existing.id);
    if (!next) {
      if (existing.status === "draft") draftItems.push(existing.id);
      else {
        problems.push(
          `item "${existing.id}" is ${existing.status} but missing from content/: set status: retired instead of deleting it`,
        );
      }
      continue;
    }
    if (existing.status !== "draft" && next.status === "draft") {
      problems.push(
        `item "${existing.id}" was ${existing.status} and can't return to draft: retire it instead`,
      );
    }
    if (next.slug !== existing.slug && !previousSlugs.get(existing.id)?.has(existing.slug)) {
      problems.push(
        `item "${existing.id}" changed slug from "${existing.slug}" to "${next.slug}": add "${existing.slug}" to previous_slugs so old links keep working`,
      );
    }
  }

  const existingSenses = await tx
    .select({ id: schema.senses.id, itemId: schema.senses.itemId })
    .from(schema.senses);
  const draftSenses: string[] = [];
  for (const existing of existingSenses) {
    if (senses.has(existing.id)) continue;
    if (existingStatus.get(existing.itemId) === "draft") draftSenses.push(existing.id);
    else {
      problems.push(
        `sense "${existing.id}" is missing from content/: mark it retired: true instead of deleting it`,
      );
    }
  }

  if (problems.length > 0) throw new UnsafeImportError(problems);
  return { items: draftItems, senses: draftSenses };
}

/** Drafts that were never published can go: nothing outside the content can refer to them. */
async function removeDrafts(tx: Transaction, drafts: { items: string[]; senses: string[] }) {
  if (drafts.senses.length > 0) {
    await tx.delete(schema.senses).where(inArray(schema.senses.id, drafts.senses));
  }
  if (drafts.items.length > 0) {
    await tx
      .delete(schema.itemSlugHistory)
      .where(inArray(schema.itemSlugHistory.itemId, drafts.items));
    await tx.delete(schema.senses).where(inArray(schema.senses.itemId, drafts.items));
    await tx.delete(schema.languageItems).where(inArray(schema.languageItems.id, drafts.items));
  }
}

// ── Writing ────────────────────────────────────────────────────────────────────────────────

async function write(tx: Transaction, rows: ContentRows) {
  await upsert(tx, schema.contentSources, rows.sources, ["id"]);

  // Self-references (replaced_by) are set in a second pass, once every target row exists.
  // A changed item gets a new timestamp and loses its release, so the release recorded at the
  // end of this import is stamped on exactly the items it inserted or changed.
  await upsert(
    tx,
    schema.languageItems,
    rows.items.map(({ replacedBy: _, ...item }) => item),
    ["id"],
    { updatedAt: sql`now()`, releaseId: sql`null` },
  );
  await setReplacements(tx, schema.languageItems, rows.items);

  await upsert(tx, schema.itemSlugHistory, rows.slugHistory, ["slug"]);
  await deleteStale(tx, schema.itemSlugHistory, ["slug"], rows.slugHistory);

  await upsert(tx, schema.itemForms, rows.forms, ["itemId", "normalized"]);
  await deleteStale(tx, schema.itemForms, ["itemId", "normalized"], rows.forms);

  await upsert(
    tx,
    schema.senses,
    rows.senses.map(({ replacedBy: _, ...sense }) => sense),
    ["id"],
  );
  await setReplacements(tx, schema.senses, rows.senses);

  await upsert(tx, schema.linkerDetails, rows.linkers, ["senseId"]);
  await deleteStale(tx, schema.linkerDetails, ["senseId"], rows.linkers);

  // Children in dependency order: patterns point at mistakes, examples at collocations and
  // patterns. Stale rows are deleted in the reverse order, after the rows pointing at them moved.
  await upsert(tx, schema.mistakes, rows.mistakes, ["id"]);
  await upsert(tx, schema.collocations, rows.collocations, ["id"]);
  await upsert(tx, schema.prepositionPatterns, rows.prepositionPatterns, ["id"]);
  await upsert(tx, schema.examples, rows.examples, ["id"]);
  await upsert(tx, schema.frames, rows.frames, ["id"]);
  await deleteStale(tx, schema.examples, ["id"], rows.examples);
  await deleteStale(tx, schema.frames, ["id"], rows.frames);
  await deleteStale(tx, schema.prepositionPatterns, ["id"], rows.prepositionPatterns);
  await deleteStale(tx, schema.collocations, ["id"], rows.collocations);
  await deleteStale(tx, schema.mistakes, ["id"], rows.mistakes);

  const relationKey = ["fromSenseId", "toSenseId", "type"] as const;
  await upsert(tx, schema.senseRelations, rows.relations, [...relationKey]);
  await deleteStale(tx, schema.senseRelations, [...relationKey], rows.relations);

  await upsert(tx, schema.intents, rows.intents, ["id"]);
  await upsert(tx, schema.intentTriggers, rows.intentTriggers, ["intentId", "normalized"]);
  await deleteStale(tx, schema.intentTriggers, ["intentId", "normalized"], rows.intentTriggers);
  await upsert(tx, schema.intentEntries, rows.intentEntries, ["intentId", "senseId"]);
  await deleteStale(tx, schema.intentEntries, ["intentId", "senseId"], rows.intentEntries);
  await deleteStale(tx, schema.intents, ["id"], rows.intents);

  await deleteStale(tx, schema.contentSources, ["id"], rows.sources);
  await rebuildSearchVectors(tx);
}

/** Rows per statement, well under PostgreSQL's 65,535 parameter limit. */
const PARAMETER_BUDGET = 30_000;

/**
 * INSERT … ON CONFLICT DO UPDATE, updating only rows whose values differ, so unchanged rows are
 * left alone and their timestamps keep meaning something.
 */
async function upsert<T extends PgTable>(
  tx: Transaction,
  table: T,
  rows: T["$inferInsert"][],
  key: (keyof T["$inferInsert"] & string)[],
  extraSet: Record<string, SQL> = {},
) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0] as object).filter((column) => !key.includes(column as never));
  const name = getTableName(table);
  const set: Record<string, SQL> = { ...extraSet };
  for (const column of columns) set[column] = sql.raw(`excluded."${snake(column)}"`);
  const changed =
    columns.length === 0
      ? undefined
      : sql.raw(
          `(${columns.map((c) => `"${name}"."${snake(c)}"`).join(", ")}) is distinct from (${columns
            .map((c) => `excluded."${snake(c)}"`)
            .join(", ")})`,
        );
  const tableColumns = getTableColumns(table) as Record<string, never>;
  const target = key.map((column) => tableColumns[column]!);
  const perStatement = Math.max(1, Math.floor(PARAMETER_BUDGET / (columns.length + key.length)));

  for (let start = 0; start < rows.length; start += perStatement) {
    const query = tx.insert(table).values(rows.slice(start, start + perStatement) as never);
    if (columns.length === 0) await query.onConflictDoNothing();
    else await query.onConflictDoUpdate({ target, set, setWhere: changed });
  }
}

/** Deletes rows whose key isn't among `rows`. With no rows, empties the table. */
async function deleteStale<T extends PgTable>(
  tx: Transaction,
  table: T,
  key: (keyof T["$inferInsert"] & string)[],
  rows: T["$inferInsert"][],
) {
  const tableColumns = getTableColumns(table) as Record<string, never>;
  const columns = sql.join(
    key.map((column) => tableColumns[column]!),
    sql`, `,
  );
  if (rows.length === 0) {
    await tx.delete(table);
    return;
  }
  if (key.length === 1) {
    const values = rows.map((row) => (row as Record<string, unknown>)[key[0]!]);
    await tx.delete(table).where(notInArray(tableColumns[key[0]!]!, values as never[]));
    return;
  }
  const tuples = sql.join(
    rows.map(
      (row) =>
        sql`(${sql.join(
          key.map((column) => sql`${(row as Record<string, unknown>)[column]}`),
          sql`, `,
        )})`,
    ),
    sql`, `,
  );
  await tx.delete(table).where(sql`(${columns}) not in (${tuples})`);
}

/** Second pass for `replaced_by`, which may point at rows written in the same import. */
async function setReplacements(
  tx: Transaction,
  table: typeof schema.languageItems | typeof schema.senses,
  rows: { id: string; replacedBy?: string | null }[],
) {
  const replaced = rows.filter((row) => row.replacedBy);
  for (const row of replaced) {
    await tx
      .update(table)
      .set({ replacedBy: row.replacedBy })
      .where(
        sql`${table.id} = ${row.id} and ${table.replacedBy} is distinct from ${row.replacedBy}`,
      );
  }
  const ids = replaced.map((row) => row.id);
  await tx
    .update(table)
    .set({ replacedBy: null })
    .where(
      ids.length > 0
        ? sql`${table.replacedBy} is not null and ${notInArray(table.id, ids)}`
        : sql`${table.replacedBy} is not null`,
    );
}

/** Full-text search over a sense's definition, notes and examples ('english' configuration). */
async function rebuildSearchVectors(tx: Transaction) {
  await tx.execute(sql`
    with document as (
      select s.id, to_tsvector('english',
        concat_ws(' ', s.label, s.definition, s.best_when, s.avoid_when, s.skill_note,
          (select string_agg(e.text, ' ' order by e.position) from examples e where e.sense_id = s.id))
      ) as vector
      from senses s
    )
    update senses set search_vector = document.vector
    from document
    where senses.id = document.id and senses.search_vector is distinct from document.vector
  `);
}

function snake(column: string) {
  return column.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function countRows(content: ValidatedContent, rows: ContentRows) {
  const byStatus = (status: string) =>
    content.items.filter((item) => item.status === status).length;
  return {
    items: rows.items.length,
    published: byStatus("published"),
    draft: byStatus("draft"),
    retired: byStatus("retired"),
    senses: rows.senses.length,
    examples: rows.examples.length,
    collocations: rows.collocations.length,
    prepositionPatterns: rows.prepositionPatterns.length,
    frames: rows.frames.length,
    mistakes: rows.mistakes.length,
    relations: rows.relations.filter((relation) => !relation.isInverse).length,
    intents: rows.intents.length,
  };
}
