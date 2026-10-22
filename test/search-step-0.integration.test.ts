import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { checkGolden } from "./golden";
import { loadPublishedContent } from "./published-content";
import { NOT_TRIGGERS, STEP_0_CASES } from "./step-0-cases";
import { createTempDatabase } from "./temp-database";

/**
 * Phase 5 Step 0 search fixes against PostgreSQL: the same cases pass on the database
 * repository, and every non-fallback answer equals the in-memory one (full-text fallback lists
 * are approximated in memory, so only their outcome is compared). Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("Step 0 search fixes (PostgreSQL)", () => {
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

  it.each(STEP_0_CASES.map((golden) => [golden.query, golden] as const))(
    "%s",
    async (_, golden) => {
      await checkGolden(pg, golden);
    },
  );

  it.each(NOT_TRIGGERS)("reads %j as an ordinary lookup, not an intent", async (query) => {
    expect((await pg.search(query))?.interpretation.intent).toBe("LOOKUP");
  });

  it.each(STEP_0_CASES.filter((golden) => golden.outcome !== "fallback").map((g) => g.query))(
    "answers %j as the in-memory repository does",
    async (query) => {
      expect(await pg.search(query)).toEqual(await memory.search(query));
    },
  );
});
