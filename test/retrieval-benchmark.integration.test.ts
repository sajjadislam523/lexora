import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LanguageSearchService } from "@/language/search/service";

import { loadPublishedContent } from "./published-content";
import { BENCHMARK_CASES, benchmarkReport, runBenchmark } from "./retrieval-benchmark";
import { createTempDatabase } from "./temp-database";

/**
 * The retrieval benchmark against PostgreSQL: the same report as the in-memory run (both
 * repositories must rank identically), and the search latency over every benchmark query.
 * Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("retrieval benchmark (PostgreSQL)", () => {
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

  it("matches the in-memory benchmark report", async () => {
    await expect(benchmarkReport(await runBenchmark(service))).toMatchFileSnapshot(
      "./retrieval-benchmark-report.txt",
    );
  });

  it("answers every benchmark query quickly (p95 under 50 ms)", async () => {
    const timings: number[] = [];
    for (let round = 0; round < 3; round++) {
      for (const c of BENCHMARK_CASES) {
        const start = performance.now();
        await service.search(c.query);
        timings.push(performance.now() - start);
      }
    }
    timings.sort((a, b) => a - b);
    const at = (q: number) => timings[Math.floor(timings.length * q)]!;
    console.info(
      `benchmark search latency over ${timings.length} searches: p50 ${at(0.5).toFixed(1)} ms · p95 ${at(0.95).toFixed(1)} ms · max ${timings.at(-1)!.toFixed(1)} ms`,
    );
    expect(at(0.95)).toBeLessThan(50);
  });
});
