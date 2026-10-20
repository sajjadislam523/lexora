import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Phase 4 closure fix R-3 against PostgreSQL: the collocation `pattern` travels in the template
 * read, and every case answers exactly as the in-memory repository does. Skipped when no database
 * is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const QUERIES = [
  "A substantial ___ to the budget",
  "There was a significant ___ on cycling",
  "It had a significant ___ in health",
  "A sharp ___ in prices",
  "A sharp ___ of prices",
  "There is substantial ___ that cars pollute",
  "There was a ___ increase in cycling",
  "A ___ amount of people",
  "substantial evidence",
];

describe.skipIf(!hasDatabase)("Phase 4 closure fixes (PostgreSQL)", () => {
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

  it("answers the same under filters", async () => {
    for (const filters of [
      { kind: "word" },
      { use: "writing" },
      { function: "importance" },
    ] as const) {
      expect(await pg.search("A substantial ___ to the budget", filters)).toEqual(
        await memory.search("A substantial ___ to the budget", filters),
      );
    }
  });
});
