import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Context-gap extensions against PostgreSQL (Phase 4 Step 4.5): every case answers exactly as the
 * in-memory repository does — the same candidates, pairs, fills, gap indexes, verdicts, signals,
 * reasons, order and mistakes. Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const QUERIES = [
  // Verb-frame pairs
  "Governments should ___ more money ___ public transport",
  "People should ___ more attention ___ environmental problems",
  "Schools should ___ more time ___ the curriculum",
  "We need to ___ more money ___ schools",
  // Pairs from a pattern on a phrase
  "Teachers ___ a crucial role ___ shaping attitudes",
  "Plastic waste ___ a threat ___ marine life",
  "Schools should ___ awareness ___ the dangers",
  "The policy ___ rise ___ protests",
  // Independent two-blank queries
  "Cars are responsible ___ pollution and depend ___ oil",
  "The council ___ land ___ housing",
  "Governments should ___ more money, ___ transport",
  // "It is ___ that"
  "It is ___ that governments should act",
  "It is ___ that I like most",
  // R-1, R-2
  "It was ___ a key role",
  "Prices have ___ sharply",
  "Schools ___ awareness campaigns",
  "Teachers play a ___ role models",
];

describe.skipIf(!hasDatabase)("context-gap extensions (PostgreSQL)", () => {
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
      { kind: "collocation" },
      { kind: "phrase" },
      { use: "writing" },
    ] as const) {
      for (const query of [
        "Governments should ___ more money ___ public transport",
        "The policy ___ rise ___ protests",
        "It is ___ that governments should act",
      ]) {
        expect(await pg.search(query, filters)).toEqual(await memory.search(query, filters));
      }
    }
  });
});
