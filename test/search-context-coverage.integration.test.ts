import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Context coverage against PostgreSQL (Phase 4 Step 4.4): every case answers exactly as the
 * in-memory repository does — the same candidates, verdicts, signals, reasons, order and mistakes.
 * Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const QUERIES = [
  "Governments must take ___ measures",
  "Campaigns to raise ___ awareness",
  "There is ___ awareness",
  "Plastic waste poses a threat ___ marine life",
  "Tourism plays a crucial role ___ the economy",
  "Schools raised awareness ___ the dangers",
  "The government takes measures ___ crime",
  "The council allocated money ___ education",
  "Governments should invest more money ___ public transport",
  "She devoted her life ___ helping others",
  "The council allocated land ___ housing",
  "The council allocated money ___",
  "Plastic waste ___ a threat to marine life",
  "There is ___ a threat",
  "It is ___ a key role",
  "Campaigns aim to ___ awareness",
  "Teachers ___ a crucial role in shaping attitudes",
  "Screens can ___ a negative effect on sleep",
  "The government took ___ to reduce crime",
  "Prices rose ___ in 2020",
  "Public transport plays a ___ role",
  "Screen time has a ___ effect on sleep",
  "This job requires ___ skill",
  "It is ___ that governments act",
  "The council allocated money ___ education and took ___ to cut costs",
];

describe.skipIf(!hasDatabase)("context coverage (PostgreSQL)", () => {
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
      { kind: "preposition_pattern" },
      { use: "speaking" },
    ] as const) {
      for (const query of [
        "The council allocated money ___ education",
        "Governments must take ___ measures",
      ]) {
        expect(await pg.search(query, filters)).toEqual(await memory.search(query, filters));
      }
    }
  });
});
