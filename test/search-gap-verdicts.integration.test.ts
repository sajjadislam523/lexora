import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Context-fit verdicts against PostgreSQL (Phase 4 Step 4.3): every case answers exactly as the
 * in-memory repository does — the same candidates, verdicts, signals, reasons, order and mistakes.
 * Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const QUERIES = [
  "responsible ___ the project",
  "responsible ___ them",
  "responsible ___ maintaining parks",
  "responsible ___",
  "depend ___ others",
  "It depends ___ whether it rains",
  "My family is very important ___ me",
  "This is important ___ young people",
  "This is crucial ___ me",
  "There was a ___ increase in cycling",
  "Public transport plays a ___ role",
  "Schools should ___ awareness about pollution",
  "___, it is often slow and crowded",
  "My brother loves the city, ___ I prefer the country",
  "Governments should ____ more money into public transportation",
  "Governments should ___ more money",
  "Cars are responsible ___ pollution and depend ___ oil",
  "Cars are responsible ___ pollution ___ cities",
];

describe.skipIf(!hasDatabase)("context-fit verdicts (PostgreSQL)", () => {
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

  it.each(QUERIES)("judges %j as the in-memory repository does", async (query) => {
    expect(await pg.search(query)).toEqual(await memory.search(query));
  });

  it("judges the same under filters", async () => {
    for (const filters of [
      { kind: "word" },
      { use: "speaking" },
      { kind: "preposition_pattern" },
    ] as const) {
      expect(await pg.search("My family is very important ___ me", filters)).toEqual(
        await memory.search("My family is very important ___ me", filters),
      );
    }
  });
});
