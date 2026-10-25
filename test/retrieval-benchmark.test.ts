import { beforeAll, describe, expect, it } from "vitest";

import { LanguageSearchService } from "@/language/search/service";
import { buildRows, type ContentRows } from "@/server/content/build";

import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";
import {
  BENCHMARK_CASES,
  BENCHMARK_CATEGORIES,
  benchmarkReport,
  metrics,
  runBenchmark,
  unknownReferences,
} from "./retrieval-benchmark";

/**
 * The retrieval benchmark over content/ in memory (pnpm test:retrieval). The report is a file
 * snapshot: a change in any case's ranking shows up as a reviewable diff. Update it with
 * `pnpm vitest run -u` and explain every changed line in the PR.
 */
describe("retrieval benchmark (in memory)", () => {
  let rows: ContentRows;
  let service: LanguageSearchService;

  beforeAll(async () => {
    rows = buildRows(await loadPublishedContent());
    service = new LanguageSearchService(new MemoryLanguageRepository(rows));
  });

  it("has enough representative cases in every category", () => {
    expect(BENCHMARK_CASES.length).toBeGreaterThanOrEqual(75);
    for (const category of BENCHMARK_CATEGORIES) {
      expect(
        BENCHMARK_CASES.filter((c) => c.category === category).length,
        category,
      ).toBeGreaterThan(0);
    }
    for (const c of BENCHMARK_CASES) {
      expect(BENCHMARK_CATEGORIES, c.query).toContain(c.category);
      expect(c.expected.length, c.query).toBeGreaterThan(0);
    }
    const queries = BENCHMARK_CASES.map((c) => c.query);
    expect(new Set(queries).size).toBe(queries.length);
  });

  it("only names language the content has", () => {
    expect(unknownReferences(rows)).toEqual([]);
  });

  it("matches the benchmark report", async () => {
    const outcomes = await runBenchmark(service);
    const report = benchmarkReport(outcomes);
    console.info(report.split("\n## Cases")[0]);
    await expect(report).toMatchFileSnapshot("./retrieval-benchmark-report.txt");
    expect(metrics(outcomes).cases).toBe(BENCHMARK_CASES.length);
  });
});
