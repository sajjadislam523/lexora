import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Saved senses against PostgreSQL: saving is per user, idempotent, limited to published
 * language, and a saved sense can't be deleted from under a learner. Uses throwaway rows with
 * unique IDs and removes them afterwards. Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("saved senses", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    repo: typeof import("@/server/repositories/saved-senses");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-item-${run}`;
  const draftItemId = `it-draft-${run}`;
  const live = `${itemId}.main`;
  const retired = `${itemId}.old`;
  const second = `${itemId}.second`;
  const inDraft = `${draftItemId}.main`;
  const learner = `it-user-${run}`;
  const other = `it-other-${run}`;

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      repo: await import("@/server/repositories/saved-senses"),
    };
    const { db, schema } = mod;
    await db
      .insert(schema.users)
      .values([learner, other].map((id) => ({ id, name: "Saver", email: `${id}@lexora.test` })));
    await db.insert(schema.contentSources).values({
      id: sourceId,
      name: "Integration test",
      kind: "editorial",
      licence: "LicenseRef-Test",
      permittedUses: ["definitions"],
    });
    await db.insert(schema.languageItems).values(
      [
        { id: itemId, status: "published" as const },
        { id: draftItemId, status: "draft" as const },
      ].map(({ id, status }) => ({
        id,
        slug: id,
        kind: "word" as const,
        headword: id,
        normalized: id,
        status,
        sourceId,
        authoredBy: "test",
      })),
    );
    const sense = {
      partOfSpeech: "adjective" as const,
      definition: "Test definition.",
      cefr: "B2" as const,
      registers: ["neutral" as const],
      skills: ["writing" as const],
      ieltsRelevance: "core" as const,
      ieltsTasks: ["writing-2" as const],
      bestWhen: "Testing.",
    };
    await db.insert(schema.senses).values([
      { ...sense, id: live, itemId, position: 0 },
      { ...sense, id: retired, itemId, position: 1, status: "retired" },
      { ...sense, id: second, itemId, position: 2 },
      { ...sense, id: inDraft, itemId: draftItemId, position: 0 },
    ]);
  });

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    await db.delete(schema.users).where(inArray(schema.users.id, [learner, other]));
    await db.delete(schema.senses).where(inArray(schema.senses.itemId, [itemId, draftItemId]));
    await db
      .delete(schema.languageItems)
      .where(inArray(schema.languageItems.id, [itemId, draftItemId]));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
    await db.$client.end();
  });

  it("saves a published sense once, however often it's saved", async () => {
    expect(await mod.repo.saveSense(learner, live)).toBe("saved");
    expect(await mod.repo.saveSense(learner, live)).toBe("saved");
    expect(await mod.repo.listSavedSenseIds(learner)).toEqual([live]);
  });

  it("keeps each learner's saves separate", async () => {
    expect(await mod.repo.listSavedSenseIds(other)).toEqual([]);
  });

  it.each([
    ["an unknown sense", "no-such-item.main"],
    ["a retired sense", `${itemId}.old`],
    ["a sense of a draft item", `${draftItemId}.main`],
  ])("refuses to save %s", async (_, senseId) => {
    expect(await mod.repo.saveSense(learner, senseId)).toBe("not_found");
    expect(await mod.repo.listSavedSenseIds(learner)).not.toContain(senseId);
  });

  it("removes a save, and removing again changes nothing", async () => {
    await mod.repo.removeSavedSense(learner, live);
    await mod.repo.removeSavedSense(learner, live);
    expect(await mod.repo.listSavedSenseIds(learner)).toEqual([]);
  });

  it("saves each meaning of an item independently", async () => {
    await mod.repo.saveSense(learner, live);
    await mod.repo.saveSense(learner, second);
    expect((await mod.repo.savedAmong(learner, [live, second, retired])).sort()).toEqual(
      [live, second].sort(),
    );
    await mod.repo.removeSavedSense(learner, live);
    expect(await mod.repo.savedAmong(learner, [live, second])).toEqual([second]);
    expect(await mod.repo.countSavedSenses(learner)).toBe(1);
    await mod.repo.removeSavedSense(learner, second);
  });

  it("answers saved state only for the senses asked about, and only for that learner", async () => {
    await mod.repo.saveSense(learner, live);
    expect(await mod.repo.savedAmong(learner, [second])).toEqual([]);
    expect(await mod.repo.savedAmong(other, [live])).toEqual([]);
    expect(await mod.repo.savedAmong(learner, [])).toEqual([]);
    await mod.repo.removeSavedSense(learner, live);
  });

  it("keeps a save when its sense is retired, but never saves a retired sense anew", async () => {
    await mod.repo.saveSense(other, second);
    await mod.db
      .update(mod.schema.senses)
      .set({ status: "retired" })
      .where(eq(mod.schema.senses.id, second));
    expect(await mod.repo.savedAmong(other, [second])).toEqual([second]);
    expect(await mod.repo.saveSense(learner, second)).toBe("not_found");
    expect(await mod.repo.removeSavedSense(other, second)).toBeUndefined();
    expect(await mod.repo.savedAmong(other, [second])).toEqual([]);
  });

  it("refuses to delete a sense someone has saved", async () => {
    await mod.repo.saveSense(learner, live);
    await expect(
      mod.db.delete(mod.schema.senses).where(eq(mod.schema.senses.id, live)),
    ).rejects.toThrow();
    expect(await mod.repo.listSavedSenseIds(learner)).toEqual([live]);
  });

  it("deletes a learner's saves with their account", async () => {
    await mod.db.delete(mod.schema.users).where(eq(mod.schema.users.id, learner));
    const rows = await mod.db
      .select()
      .from(mod.schema.savedSenses)
      .where(eq(mod.schema.savedSenses.userId, learner));
    expect(rows).toEqual([]);
  });
});
