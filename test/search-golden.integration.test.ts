import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EXAMPLE_SEARCHES } from "@/language/examples";
import type { LanguageSearchService } from "@/language/search/service";

import { checkGolden, GOLDEN_CASES, rankingSnapshot, snapshotQueries } from "./golden";
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

  // Phase 4 Step 1 re-check of the audit's "noisy fallback": on PostgreSQL the full-text
  // fallback (plainto_tsquery, every word required, ts_rank) is precise. The noise came from the
  // in-memory repository, which matches any one word and only approximates it, so these
  // expectations hold for PostgreSQL only.
  it.each([
    ["climate change", ["pose a threat"]],
    ["describe a graph", ["rise sharply"]],
    ["words about the environment", ["have a detrimental effect on"]],
  ])("keeps the full-text fallback precise for %j", async (query, expected) => {
    const response = await service.search(query);
    expect(response?.outcome).toBe("fallback");
    expect(response?.groups.flatMap((g) => g.results.map((r) => r.term))).toEqual(expected);
  });

  it("finds nothing rather than loosely related language", async () => {
    expect((await service.search("writing task 1 language"))?.outcome).toBe("none");
  });

  // The same file as the in-memory run: both repositories must rank identically.
  it("matches the ranking snapshot", async () => {
    const queries = snapshotQueries(EXAMPLE_SEARCHES.map((example) => example.text));
    await expect(await rankingSnapshot(service, queries)).toMatchFileSnapshot(
      "./search-snapshot.txt",
    );
  });

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
