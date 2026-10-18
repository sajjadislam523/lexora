import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * The gap reader against PostgreSQL (Phase 4 Step 4.1): every gap and fallback case answers
 * exactly as the in-memory repository does, which test/search-gaps.test.ts checks in detail.
 * Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const QUERIES = [
  "Governments should ____ more money into public transportation",
  "Governments should … more money into public transportation",
  "Governments should ___ more money ___ public transport",
  "Well... Governments should ___ more money into transport",
  "responsible ___ the project",
  "depend ___ others",
  "I like ___",
  "however...",
  "There is growing concern about ...",
  "It is worth noting that...",
  "a ___ b ___ c ___ d",
  "____",
];

describe.skipIf(!hasDatabase)("gap reader (PostgreSQL)", () => {
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
});
