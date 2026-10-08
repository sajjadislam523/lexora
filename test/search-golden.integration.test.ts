import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { checkGolden, GOLDEN_CASES } from "./golden";
import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * The golden suite against PostgreSQL: content/ imported into a throwaway database, searched
 * through the real repository (trigram candidates, full text). Also a performance smoke test.
 * Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("golden search suite (PostgreSQL)", () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let service: LanguageSearchService;

  beforeAll(async () => {
    temp = await createTempDatabase();
    const { importContent } = await import("@/server/content/import");
    const { DatabaseLanguageRepository } = await import("@/server/repositories/language");
    const { LanguageSearchService } = await import("@/language/search/service");
    await importContent(temp.db, await loadPublishedContent());
    service = new LanguageSearchService(new DatabaseLanguageRepository(temp.db));
  });

  afterAll(async () => {
    await temp?.drop();
  });

  it.each(GOLDEN_CASES.map((golden) => [golden.query, golden] as const))(
    "%s",
    async (_, golden) => {
      await checkGolden(service, golden);
    },
  );

  it("answers the golden queries quickly (p95 under 50 ms)", async () => {
    const timings: number[] = [];
    for (let round = 0; round < 3; round++) {
      for (const golden of GOLDEN_CASES) {
        const start = performance.now();
        await service.search(golden.query);
        timings.push(performance.now() - start);
      }
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95)]!;
    expect(p95).toBeLessThan(50);
  });
});
