import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db/client";
import { languageItems, savedSenses, senses } from "@/server/db/schema";

/**
 * Saved language. Every function takes the user ID explicitly; callers pass the ID from the
 * validated session, never one supplied by the client.
 */

/** The learner's saved sense IDs, most recent first. Retired senses stay listed: they were saved. */
export async function listSavedSenseIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ senseId: savedSenses.senseId })
    .from(savedSenses)
    .where(eq(savedSenses.userId, userId))
    .orderBy(desc(savedSenses.savedAt), savedSenses.senseId);
  return rows.map((row) => row.senseId);
}

/**
 * Which of these senses the learner has saved: one bounded query for the senses on a page,
 * never the whole collection.
 */
export async function savedAmong(userId: string, senseIds: readonly string[]): Promise<string[]> {
  if (senseIds.length === 0) return [];
  const rows = await db
    .select({ senseId: savedSenses.senseId })
    .from(savedSenses)
    .where(and(eq(savedSenses.userId, userId), inArray(savedSenses.senseId, [...senseIds])));
  return rows.map((row) => row.senseId);
}

export async function countSavedSenses(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(savedSenses)
    .where(eq(savedSenses.userId, userId));
  return row?.total ?? 0;
}

/**
 * Saves a sense. Only published senses of published items can be newly saved; saving one that
 * is already saved changes nothing (and keeps its original date).
 */
export async function saveSense(userId: string, senseId: string): Promise<"saved" | "not_found"> {
  const [sense] = await db
    .select({ id: senses.id })
    .from(senses)
    .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
    .where(
      and(
        eq(senses.id, senseId),
        eq(senses.status, "published"),
        eq(languageItems.status, "published"),
      ),
    )
    .limit(1);
  if (!sense) return "not_found";

  await db.insert(savedSenses).values({ userId, senseId }).onConflictDoNothing();
  return "saved";
}

/** Removes a save. Removing one that isn't saved changes nothing. */
export async function removeSavedSense(userId: string, senseId: string) {
  await db
    .delete(savedSenses)
    .where(and(eq(savedSenses.userId, userId), eq(savedSenses.senseId, senseId)));
}
