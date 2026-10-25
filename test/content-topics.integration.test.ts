import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DISCOURSE_FUNCTIONS, TOPICS } from "@/language/schema/vocabulary";

import { fixtureContent, sense, toFiles, type FixtureContent } from "./content-fixture";
import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Topics and the Phase 4 discourse functions against PostgreSQL (migration 0004): the enums match
 * the vocabulary, topics are stored per sense, the published content imports unchanged without
 * them, and re-imports are idempotent. Each test file has its own throwaway database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("topics and discourse functions (PostgreSQL)", () => {
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

  function importFixture(mutate?: (content: FixtureContent) => void) {
    const content = fixtureContent();
    mutate?.(content);
    const result = mod.validate.validateContent(toFiles(content));
    if (!result.ok) throw new Error(result.issues.map(mod.validate.formatIssue).join("\n"));
    return mod.importer.importContent(temp.db, result.content);
  }

  async function sensesById() {
    const s = mod.schema;
    const rows = await temp.db.select().from(s.senses).orderBy(asc(s.senses.id));
    return new Map(rows.map((row) => [row.id, row]));
  }

  async function enumValues(name: string) {
    const rows = await temp.db.execute<{ value: string }>(sql`
      select e.enumlabel as value from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = ${name} order by e.enumsortorder
    `);
    return rows.map((row) => row.value);
  }

  it("migrates the topic enum and the discourse functions exactly as in the vocabulary", async () => {
    expect(await enumValues("topic")).toEqual([...TOPICS]);
    expect(await enumValues("discourse_function")).toEqual([...DISCOURSE_FUNCTIONS]);
  });

  it("imports the published content unchanged, with its authored topics", async () => {
    const content = await loadPublishedContent();
    expect((await mod.importer.importContent(temp.db, content)).status).toBe("imported");

    const s = mod.schema;
    const published = await temp.db
      .select({ id: s.languageItems.id })
      .from(s.languageItems)
      .where(eq(s.languageItems.status, "published"));
    expect(published).toHaveLength(420);
    const senses = await sensesById();
    expect(senses.size).toBe(442);
    // Topics arrived with the content expansion (Wave 2); each sense stores exactly its own.
    for (const item of content.items) {
      for (const authored of item.senses) {
        expect(
          senses.get(`${item.id}.${authored.key}`)?.topics,
          `${item.id}.${authored.key}`,
        ).toEqual(authored.topics ?? []);
      }
    }

    expect((await mod.importer.importContent(temp.db, content)).status).toBe("unchanged");
  });

  describe("on the fixture", () => {
    beforeAll(async () => {
      // A fresh start for the fixture: the published content above isn't part of it.
      await temp.drop();
      temp = await createTempDatabase();
    });

    it("stores topics per meaning, and none for general language", async () => {
      await importFixture((c) => {
        sense(c, "crucial").topics = ["health", "education", "work"];
        sense(c, "important").topics = ["economy"];
      });
      const senses = await sensesById();
      expect(senses.get("crucial.essential")?.topics).toEqual(["health", "education", "work"]);
      expect(senses.get("important.main")?.topics).toEqual(["economy"]);
      expect(senses.get("however.contrast")?.topics).toEqual([]);
    });

    it("re-imports the same topics without changing anything", async () => {
      const before = await sensesById();
      const result = await importFixture((c) => {
        sense(c, "crucial").topics = ["health", "education", "work"];
        sense(c, "important").topics = ["economy"];
      });
      expect(result.status).toBe("unchanged");
      expect(await sensesById()).toEqual(before);
    });

    it("changes only the edited sense, keeping every ID", async () => {
      const before = await sensesById();
      await importFixture((c) => {
        sense(c, "crucial").topics = ["health"];
        sense(c, "important").topics = ["economy"];
      });
      const after = await sensesById();
      expect([...after.keys()]).toEqual([...before.keys()]);
      expect(after.get("crucial.essential")?.topics).toEqual(["health"]);
      for (const id of ["important.main", "however.contrast", "analyse.examine"]) {
        expect(after.get(id)).toEqual(before.get(id));
      }
    });

    it("clears topics when they are removed from the content", async () => {
      await importFixture();
      const senses = await sensesById();
      expect([...senses.values()].every((row) => row.topics.length === 0)).toBe(true);
    });

    it("stores the new discourse functions", async () => {
      await importFixture((c) => {
        sense(c, "crucial").functions = ["comparison", "decrease", "opinion", "hedging"];
      });
      expect((await sensesById()).get("crucial.essential")?.functions).toEqual([
        "comparison",
        "decrease",
        "opinion",
        "hedging",
      ]);
    });

    it("gives two meanings of one item their own topics", async () => {
      await importFixture((c) => {
        sense(c, "crucial").topics = ["health"];
        (c.items.crucial!.senses as unknown[]).push({
          ...structuredClone(sense(c, "crucial")),
          key: "deciding",
          label: "deciding an outcome",
          standalone: "A second meaning for this test only.",
          topics: ["government", "economy"],
        });
      });
      const senses = await sensesById();
      expect(senses.get("crucial.essential")?.topics).toEqual(["health"]);
      expect(senses.get("crucial.deciding")?.topics).toEqual(["government", "economy"]);
    });

    it("refuses more than three topics in the database itself", async () => {
      const s = mod.schema;
      const error = await temp.db
        .update(s.senses)
        .set({ topics: ["health", "education", "work", "economy"] })
        .where(eq(s.senses.id, "crucial.essential"))
        .then(
          () => undefined,
          (e: unknown) => e,
        );
      const cause = (error as { cause?: { constraint_name?: string } } | undefined)?.cause;
      expect(cause?.constraint_name).toBe("senses_topics_max");
      const [row] = await temp.db
        .select({ topics: s.senses.topics })
        .from(s.senses)
        .where(eq(s.senses.id, "crucial.essential"));
      expect(row?.topics).toEqual(["health"]);
    });
  });
});
