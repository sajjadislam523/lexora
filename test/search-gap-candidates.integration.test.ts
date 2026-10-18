import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Context-gap candidates against PostgreSQL (Phase 4 Step 4.2): every case answers exactly as the
 * in-memory repository does (test/search-gap-candidates.test.ts checks the details): the same
 * candidates, senses, blanks, order and fallbacks. Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const QUERIES = [
  "responsible ___ the project",
  "depend ___ others",
  "interested ___ the subject",
  "The report focused ___ housing",
  "Exercise contributes ___ health",
  "important ___",
  "crucial ___ success",
  "There was a ___ increase in cycling",
  "Public transport plays a ___ role",
  "Governments should take ___ to reduce crime",
  "Schools could raise ___ of the dangers",
  "a ___ the",
  "The ___ is high",
  "___, it is often slow and crowded",
  "My brother loves the city, ___ I prefer the country",
  "Prices rose, ___ demand fell",
  "___ it is often slow",
  "Cars are responsible ___ pollution and depend ___ oil",
  "Cars are responsible ___ pollution ___ cities",
  "Governments should ___ more money ___ public transport",
  "There was a … increase in cycling",
];

describe.skipIf(!hasDatabase)("context-gap candidates (PostgreSQL)", () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let pg: LanguageSearchService;
  let memory: LanguageSearchService;

  beforeAll(async () => {
    temp = await createTempDatabase();
    const { importContent } = await import("@/server/content/import");
    const { DatabaseLanguageRepository } = await import("@/server/repositories/language");
    const { LanguageSearchService } = await import("@/language/search/service");
    const { buildRows } = await import("@/server/content/build");
    const { MemoryLanguageRepository } = await import("./memory-language-repository");
    const content = await loadPublishedContent();
    await importContent(temp.db, content);
    pg = new LanguageSearchService(new DatabaseLanguageRepository(temp.db));
    memory = new LanguageSearchService(new MemoryLanguageRepository(buildRows(content)));
  });

  afterAll(async () => {
    await temp?.drop();
  });

  it.each(QUERIES)("answers %j as the in-memory repository does", async (query) => {
    expect(await pg.search(query)).toEqual(await memory.search(query));
  });

  it("falls back the same way (the fallback's full-text list is PostgreSQL's own)", async () => {
    const [onPg, inMemory] = await Promise.all([
      pg.search("The results were ... surprising"),
      memory.search("The results were ... surprising"),
    ]);
    for (const response of [onPg, inMemory]) {
      expect(response?.interpretation.intent).toBe("LOOKUP");
      expect(response).not.toHaveProperty("gaps");
    }
  });

  it("filters candidates the same way", async () => {
    for (const filters of [{ kind: "word" }, { kind: "linker" }, { use: "speaking" }] as const) {
      expect(await pg.search("___, it is often slow and crowded", filters)).toEqual(
        await memory.search("___, it is often slow and crowded", filters),
      );
    }
  });
});
