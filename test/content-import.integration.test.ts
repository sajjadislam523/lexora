import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fixtureContent, sense, toFiles, type FixtureContent } from "./content-fixture";
import { createTempDatabase } from "./temp-database";

/**
 * The content importer against a throwaway PostgreSQL database: idempotent, keeps IDs across
 * edits so saved senses survive, deletes only what is no longer authored, and refuses to drop
 * published content. Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("content import", () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let mod: {
    schema: typeof import("@/server/db/schema");
    importer: typeof import("@/server/content/import");
    validate: typeof import("@/server/content/validate");
  };

  beforeAll(async () => {
    temp = await createTempDatabase();
    mod = {
      schema: await import("@/server/db/schema"),
      importer: await import("@/server/content/import"),
      validate: await import("@/server/content/validate"),
    };
  });

  afterAll(async () => {
    await temp?.drop();
  });

  function contentOf(content: FixtureContent) {
    const result = mod.validate.validateContent(toFiles(content));
    if (!result.ok) throw new Error(result.issues.map(mod.validate.formatIssue).join("\n"));
    return result.content;
  }

  function importFixture(mutate?: (content: FixtureContent) => void, force = false) {
    const content = fixtureContent();
    mutate?.(content);
    return mod.importer.importContent(temp.db, contentOf(content), { force });
  }

  /** Every content table, for "nothing changed" comparisons. */
  async function snapshot() {
    const { db } = temp;
    const s = mod.schema;
    return {
      items: await db.select().from(s.languageItems).orderBy(asc(s.languageItems.id)),
      forms: await db.select().from(s.itemForms).orderBy(asc(s.itemForms.id)),
      senses: await db.select().from(s.senses).orderBy(asc(s.senses.id)),
      examples: await db.select().from(s.examples).orderBy(asc(s.examples.id)),
      relations: await db
        .select()
        .from(s.senseRelations)
        .orderBy(asc(s.senseRelations.fromSenseId), asc(s.senseRelations.toSenseId)),
      triggers: await db.select().from(s.intentTriggers).orderBy(asc(s.intentTriggers.normalized)),
    };
  }

  it("imports into an empty database", async () => {
    const result = await importFixture();
    expect(result).toMatchObject({
      status: "imported",
      counts: { items: 4, published: 4, senses: 4, examples: 8, relations: 1, intents: 1 },
    });

    const { db } = temp;
    const s = mod.schema;
    const relations = await db.select().from(s.senseRelations);
    expect(relations).toHaveLength(2);
    expect(relations.find((r) => r.isInverse)).toMatchObject({
      fromSenseId: "crucial.essential",
      toSenseId: "important.main",
      type: "weaker",
    });

    const [vector] = await db.execute<{ matches: boolean }>(
      sql`select search_vector @@ to_tsquery('english', 'outcome') as matches from senses where id = 'crucial.essential'`,
    );
    expect(vector?.matches).toBe(true);

    const items = await db.select().from(s.languageItems);
    expect(items.every((item) => item.releaseId === result.releaseId)).toBe(true);
  });

  it("does nothing when the content is unchanged", async () => {
    const before = await snapshot();
    expect((await importFixture()).status).toBe("unchanged");
    expect(await snapshot()).toEqual(before);
  });

  it("changes no rows when forced to re-import the same content", async () => {
    const before = await snapshot();
    expect((await importFixture(undefined, true)).status).toBe("imported");
    expect(await snapshot()).toEqual(before);
  });

  it("keeps IDs across edits, so a saved sense survives re-import", async () => {
    const { db } = temp;
    const s = mod.schema;
    await db.insert(s.users).values({ id: "learner", name: "Learner", email: "l@lexora.test" });
    await db.insert(s.savedSenses).values({ userId: "learner", senseId: "crucial.essential" });

    const before = await snapshot();
    const result = await importFixture((c) => {
      sense(c, "crucial").best_when = "An outcome really depends on it.";
    });
    expect(result.status).toBe("imported");

    const after = await snapshot();
    expect(after.senses.map((row) => row.id)).toEqual(before.senses.map((row) => row.id));
    expect(after.senses.find((row) => row.id === "crucial.essential")?.bestWhen).toBe(
      "An outcome really depends on it.",
    );
    // Only the edited item's row changed; the others keep their release and timestamp.
    const changed = after.items.filter(
      (item, i) => item.updatedAt.getTime() !== before.items[i]!.updatedAt.getTime(),
    );
    expect(changed.map((item) => item.id)).toEqual([]);
    expect(await db.select().from(s.savedSenses)).toEqual([
      expect.objectContaining({ userId: "learner", senseId: "crucial.essential" }),
    ]);
  });

  it("removes child rows that are no longer authored", async () => {
    await importFixture((c) => {
      const crucial = sense(c, "crucial");
      crucial.examples = [
        ...(crucial.examples as Record<string, unknown>[]),
        { id: "ex3", text: "Timing is crucial here.", highlight: "crucial", skill: "writing" },
      ];
    });
    await importFixture();
    const examples = await temp.db
      .select({ id: mod.schema.examples.id })
      .from(mod.schema.examples)
      .where(eq(mod.schema.examples.senseId, "crucial.essential"));
    expect(examples.map((row) => row.id).sort()).toEqual([
      "crucial.essential:ex1",
      "crucial.essential:ex2",
    ]);
  });

  it("refuses to drop a published item or sense", async () => {
    await expect(
      importFixture((c) => {
        delete c.items.analyse;
      }),
    ).rejects.toThrow(
      /item "analyse" is published but missing from content\/: set status: retired/,
    );

    await expect(
      importFixture((c) => {
        (c.items.crucial!.senses as unknown[]).push({
          ...sense(c, "crucial"),
          key: "extra",
          standalone: "Test sense.",
        });
      }).then(() => importFixture()),
    ).rejects.toThrow(/sense "crucial.extra" is missing from content\/: mark it retired: true/);

    // The refused import changed nothing: the sense added a moment ago is still there.
    const [extra] = await temp.db
      .select()
      .from(mod.schema.senses)
      .where(eq(mod.schema.senses.id, "crucial.extra"));
    expect(extra).toBeDefined();
  });

  it("retires a sense instead of deleting it", async () => {
    await importFixture((c) => {
      (c.items.crucial!.senses as unknown[]).push({
        ...sense(c, "crucial"),
        key: "extra",
        retired: true,
        replaced_by: "crucial.essential",
      });
    });
    const [extra] = await temp.db
      .select()
      .from(mod.schema.senses)
      .where(eq(mod.schema.senses.id, "crucial.extra"));
    expect(extra).toMatchObject({ status: "retired", replacedBy: "crucial.essential" });
  });

  it("retires an item with a replacement, and refuses to return it to draft", async () => {
    const retire = (c: FixtureContent) => {
      (c.items.crucial!.senses as unknown[]).push({
        ...sense(c, "crucial"),
        key: "extra",
        retired: true,
        replaced_by: "crucial.essential",
      });
      c.items.analyse!.status = "retired";
      c.items.analyse!.replaced_by = "crucial";
    };
    await importFixture(retire);
    const [analyse] = await temp.db
      .select()
      .from(mod.schema.languageItems)
      .where(eq(mod.schema.languageItems.id, "analyse"));
    expect(analyse).toMatchObject({ status: "retired", replacedBy: "crucial" });

    await expect(
      importFixture((c) => {
        retire(c);
        c.items.analyse!.status = "draft";
        delete c.items.analyse!.replaced_by;
      }),
    ).rejects.toThrow(/"analyse" was retired and can't return to draft/);
  });

  it("requires the old slug to be kept when a slug changes", async () => {
    const keepRetired = (c: FixtureContent) => {
      (c.items.crucial!.senses as unknown[]).push({
        ...sense(c, "crucial"),
        key: "extra",
        retired: true,
        replaced_by: "crucial.essential",
      });
      c.items.analyse!.status = "retired";
      c.items.analyse!.replaced_by = "crucial";
    };
    await expect(
      importFixture((c) => {
        keepRetired(c);
        c.items.crucial!.slug = "crucial-adjective";
      }),
    ).rejects.toThrow(/add "crucial" to previous_slugs/);

    await importFixture((c) => {
      keepRetired(c);
      c.items.crucial!.slug = "crucial-adjective";
      c.items.crucial!.previous_slugs = ["crucial"];
    });
    expect(await temp.db.select().from(mod.schema.itemSlugHistory)).toEqual([
      { slug: "crucial", itemId: "crucial" },
    ]);
  });

  it("deletes a draft that was never published once it leaves the content", async () => {
    const withDraft = (c: FixtureContent) => {
      (c.items.crucial!.senses as unknown[]).push({
        ...sense(c, "crucial"),
        key: "extra",
        retired: true,
        replaced_by: "crucial.essential",
      });
      c.items.analyse!.status = "retired";
      c.items.analyse!.replaced_by = "crucial";
      c.items.crucial!.slug = "crucial-adjective";
      c.items.crucial!.previous_slugs = ["crucial"];
    };
    await importFixture((c) => {
      withDraft(c);
      c.items.vital = {
        ...structuredClone(c.items.crucial!),
        id: "vital",
        headword: "vital",
        status: "draft",
        forms: [{ form: "vital", type: "lemma" }],
      };
      delete c.items.vital.slug;
      delete c.items.vital.previous_slugs;
    });
    await importFixture(withDraft);
    const vital = await temp.db
      .select()
      .from(mod.schema.languageItems)
      .where(eq(mod.schema.languageItems.id, "vital"));
    expect(vital).toEqual([]);
  });
});
