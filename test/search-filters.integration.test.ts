import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import type { LanguageSearchService } from "@/language/search/service";

import { fixtureContent, sense, toFiles } from "./content-fixture";
import { GOLDEN_CASES } from "./golden";
import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Search filters and browse (Phase 4 Step 3a) against PostgreSQL. On the published content, every
 * filtered golden search, browse page and count must equal the in-memory repository's, which the
 * unit tests check in detail; browse filtering and counting happen in SQL. A tagged fixture shows
 * topics working end to end. Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

/** Every single filter value (38). */
const SINGLE_FILTERS: SearchFilters[] = FILTER_DIMENSIONS.flatMap((dimension) =>
  FILTER_VALUES[dimension].map((value) => ({ [dimension]: value }) as SearchFilters),
);

describe.skipIf(!hasDatabase)("search filters and browse (PostgreSQL)", () => {
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

  // The engine's answer is identical on both repositories (the ranking snapshot); what filtering
  // adds on PostgreSQL is senseFacets, checked here for every published sense.
  it("reads the same filter metadata for every published sense", async () => {
    const senseIds = new Set<string>();
    for (const use of ["writing", "speaking"] as const) {
      const first = await pg.browse({ use });
      for (let page = 1; page <= first.pages; page++) {
        const items = page === 1 ? first.items : (await pg.browse({ use }, page)).items;
        for (const item of items) senseIds.add(item.senseId);
      }
    }
    const repoOf = (service: LanguageSearchService) =>
      (service as unknown as { repo: { senseFacets(ids: string[]): Promise<unknown[]> } }).repo;
    const sort = (rows: unknown[]) =>
      [...(rows as { senseId: string }[])].sort((a, b) => a.senseId.localeCompare(b.senseId));
    expect(senseIds.size).toBe(442);
    expect(sort(await repoOf(pg).senseFacets([...senseIds]))).toEqual(
      sort(await repoOf(memory).senseFacets([...senseIds])),
    );
  });

  it("restricts the golden searches exactly as the in-memory repository does", async () => {
    const filters: SearchFilters[] = [
      { kind: "linker" },
      { kind: "word" },
      { function: "contrast" },
      { use: "speaking" },
      { use: "writing-1" },
      { topic: "environment" },
      { kind: "word", use: "writing-2", function: "importance" },
    ];
    const ids = (r: Awaited<ReturnType<LanguageSearchService["search"]>>) =>
      r?.groups.flatMap((g) => g.results.map((x) => x.senseId)) ?? [];
    for (const golden of GOLDEN_CASES) {
      for (const filter of filters) {
        const label = `${golden.query} + ${JSON.stringify(filter)}`;
        const filtered = await pg.search(golden.query, filter);
        if (golden.outcome === "fallback") {
          // Full-text lists are PostgreSQL's own (the in-memory one only approximates them):
          // check the filtered list against PostgreSQL's unfiltered one instead.
          const plain = ids(await pg.search(golden.query));
          const kept = ids(filtered);
          expect(
            plain.filter((id) => kept.includes(id)),
            label,
          ).toEqual(kept);
          continue;
        }
        expect(filtered, label).toEqual(await memory.search(golden.query, filter));
      }
    }
  });

  it("browses every filter value with the same pages and counts", async () => {
    for (const filters of [
      ...SINGLE_FILTERS,
      { kind: "linker", use: "speaking" },
      { function: "contrast", use: "writing-2" },
      { kind: "word", function: "importance", use: "writing" },
    ] satisfies SearchFilters[]) {
      const first = await pg.browse(filters);
      expect(first, JSON.stringify(filters)).toEqual(await memory.browse(filters));
      if (first.pages > 1)
        expect(await pg.browse(filters, 2)).toEqual(await memory.browse(filters, 2));
    }
  });

  it("refuses invalid filters before any SQL is built", async () => {
    for (const filters of [
      { kind: "linker'; drop table senses; --" },
      { topic: "health') or ('1'='1" },
      { use: ["writing"] },
    ]) {
      await expect(pg.browse(filters as unknown as SearchFilters)).rejects.toThrow();
      await expect(pg.search("important", filters as unknown as SearchFilters)).rejects.toThrow();
    }
    expect((await pg.browse({ kind: "linker" })).total).toBe(40);
  });

  describe("topics on a tagged fixture", () => {
    let tagged: LanguageSearchService;

    beforeAll(async () => {
      await temp.drop();
      temp = await createTempDatabase();
      const { importContent } = await import("@/server/content/import");
      const { validateContent } = await import("@/server/content/validate");
      const { DatabaseLanguageRepository } = await import("@/server/repositories/language");
      const { LanguageSearchService } = await import("@/language/search/service");
      const content = fixtureContent();
      Object.assign(sense(content, "important"), { topics: ["work", "economy"] });
      Object.assign(sense(content, "crucial"), { topics: ["health"], functions: ["hedging"] });
      const result = validateContent(toFiles(content));
      if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
      await importContent(temp.db, result.content);
      tagged = new LanguageSearchService(new DatabaseLanguageRepository(temp.db));
    });

    it("browses and searches by topic, never matching general language", async () => {
      const browse = await tagged.browse({ topic: "health" });
      expect(browse.items.map((item) => item.senseId)).toEqual(["crucial.essential"]);
      expect(browse.counts.topic).toEqual({ work: 1, economy: 1, health: 1 });
      expect((await tagged.browse({ topic: "environment" })).total).toBe(0);
      const search = await tagged.search("important", { topic: "work" });
      expect(search?.groups.flatMap((g) => g.results.map((r) => r.senseId))).toEqual([
        "important.main",
      ]);
      expect((await tagged.browse({ function: "hedging", topic: "health" })).total).toBe(1);
    });
  });
});
