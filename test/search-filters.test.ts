import { beforeAll, describe, expect, it } from "vitest";

import {
  FILTER_DIMENSIONS,
  FILTER_VALUES,
  matchesFilters,
  type SearchFilters,
} from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";
import { validateContent } from "@/server/content/validate";

import { fixtureContent, sense, toFiles } from "./content-fixture";
import { GOLDEN_CASES } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * Search filters and browse (Phase 4 Step 3a) on the in-memory repository. The fixture gets
 * topics and the new functions here, in the test only; the published content has none.
 *
 * - important.main     word    writing+speaking  writing-2, speaking-1  core   importance, opinion  work, economy
 * - crucial.essential  word    writing           writing-2              core   comparison           health
 * - analyse.examine    word    writing           writing-1              high   —                    — (general)
 * - however.contrast   linker  writing           writing-2              core   contrast, decrease   environment
 */
function taggedService() {
  const content = fixtureContent();
  Object.assign(sense(content, "important"), {
    topics: ["work", "economy"],
    functions: ["importance", "opinion"],
  });
  Object.assign(sense(content, "crucial"), { topics: ["health"], functions: ["comparison"] });
  Object.assign(sense(content, "however"), {
    topics: ["environment"],
    functions: ["contrast", "decrease"],
  });
  const result = validateContent(toFiles(content));
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
  return new LanguageSearchService(new MemoryLanguageRepository(buildRows(result.content)));
}

const ids = (response: SearchResponse | null) =>
  response?.groups.flatMap((group) => group.results.map((result) => result.senseId)) ?? [];

describe("search with filters (fixture)", () => {
  const service = taggedService();

  it("returns the engine's answer unchanged without filters", async () => {
    const plain = await service.search("important");
    expect(await service.search("important", {})).toEqual(plain);
    expect(await service.search("important", undefined)).toEqual(plain);
    expect(plain).not.toHaveProperty("filters");
  });

  it("keeps the reading and order, and only removes results that don't match", async () => {
    const plain = await service.search("important");
    const filtered = await service.search("important", { topic: "health" });
    expect(filtered?.interpretation).toEqual(plain?.interpretation);
    expect(ids(plain)).toEqual(["important.main", "crucial.essential"]);
    expect(ids(filtered)).toEqual(["crucial.essential"]);
    expect(filtered?.filters).toEqual({ applied: { topic: "health" }, before: 2, after: 1 });
  });

  it("never matches general language to a topic", async () => {
    const response = await service.search("analyse", { topic: "education" });
    expect(ids(response)).toEqual([]);
    expect(ids(await service.search("analyse"))).toEqual(["analyse.examine"]);
  });

  it("says honestly when the filters hide every result, without relaxing them", async () => {
    const response = await service.search("important", { topic: "environment" });
    expect(response).toMatchObject({
      outcome: "none",
      groups: [],
      filters: { applied: { topic: "environment" }, before: 2, after: 0 },
    });
    expect(response?.interpretation.term?.resolved).toBe("important");
  });

  it("filters by kind, function and IELTS use", async () => {
    expect(ids(await service.search("however", { kind: "linker" }))).toEqual(["however.contrast"]);
    expect(ids(await service.search("however", { kind: "word" }))).toEqual([]);
    expect(ids(await service.search("important", { function: "opinion" }))).toEqual([
      "important.main",
    ]);
    expect(ids(await service.search("important", { function: "comparison" }))).toEqual([
      "crucial.essential",
    ]);
    expect(ids(await service.search("important", { use: "speaking" }))).toEqual(["important.main"]);
    expect(ids(await service.search("important", { use: "speaking-1" }))).toEqual([
      "important.main",
    ]);
    expect(ids(await service.search("important", { use: "writing-2" }))).toEqual([
      "important.main",
      "crucial.essential",
    ]);
  });

  it("combines filters with AND", async () => {
    const cases: [SearchFilters, string[]][] = [
      [{ topic: "work", kind: "word" }, ["important.main"]],
      [{ topic: "health", function: "comparison" }, ["crucial.essential"]],
      [{ kind: "word", function: "opinion" }, ["important.main"]],
      [{ topic: "health", use: "speaking" }, []],
      [{ topic: "work", function: "opinion", kind: "word" }, ["important.main"]],
      [{ topic: "work", function: "opinion", kind: "word", use: "speaking-1" }, ["important.main"]],
      [{ topic: "work", function: "opinion", kind: "word", use: "writing-1" }, []],
    ];
    for (const [filters, expected] of cases) {
      expect(ids(await service.search("important", filters)), JSON.stringify(filters)).toEqual(
        expected,
      );
    }
  });

  it("keeps a mistake only when its sense matches", async () => {
    const query = "Family is very important for me";
    expect((await service.search(query, { kind: "word" }))?.mistakes).toHaveLength(1);
    expect((await service.search(query, { kind: "linker" }))?.mistakes).toEqual([]);
  });

  it("keeps only the fit-guide rows of the results it shows", async () => {
    const plain = await service.search("better word for important");
    const filtered = await service.search("better word for important", { topic: "health" });
    expect(plain?.guide?.rows.map((row) => row.term)).toContain("crucial");
    expect(filtered?.guide?.rows.map((row) => row.term)).toEqual(["crucial"]);
    expect(
      (await service.search("better word for important", { topic: "environment" }))?.guide,
    ).toBeUndefined();
  });

  it.each([
    [{ topic: "sport" }],
    [{ kind: "preposition-pattern" }],
    [{ kind: "linker' OR 1=1 --" }],
    [{ kind: ["linker"] }],
    [{ register: "formal" }],
  ])("rejects invalid filters %j instead of ignoring them", async (filters) => {
    await expect(service.search("important", filters as SearchFilters)).rejects.toThrow();
    await expect(service.browse(filters as SearchFilters)).rejects.toThrow();
  });
});

describe("browse (fixture)", () => {
  const service = taggedService();

  it("needs at least one filter and a whole page number", async () => {
    await expect(service.browse({})).rejects.toThrow();
    await expect(service.browse({ kind: "word" }, 0)).rejects.toThrow();
    await expect(service.browse({ kind: "word" }, 1.5)).rejects.toThrow();
  });

  it("lists matching senses: core first, then A–Z", async () => {
    const response = await service.browse({ use: "writing" });
    expect(response.items.map((item) => item.senseId)).toEqual([
      "crucial.essential",
      "however.contrast",
      "important.main",
      "analyse.examine",
    ]);
    expect(response).toMatchObject({ page: 1, pageSize: 30, total: 4, pages: 1 });
  });

  it("filters by every dimension and their combination", async () => {
    const list = async (filters: SearchFilters) =>
      (await service.browse(filters)).items.map((item) => item.senseId);
    expect(await list({ topic: "environment" })).toEqual(["however.contrast"]);
    expect(await list({ function: "decrease" })).toEqual(["however.contrast"]);
    expect(await list({ function: "hedging" })).toEqual([]);
    expect(await list({ kind: "linker", use: "writing-2" })).toEqual(["however.contrast"]);
    expect(await list({ use: "writing-1" })).toEqual(["analyse.examine"]);
    expect(
      await list({ kind: "word", function: "opinion", use: "speaking", topic: "economy" }),
    ).toEqual(["important.main"]);
  });

  it("counts each dimension's values against the other filters", async () => {
    const { counts } = await service.browse({ kind: "word" });
    // Kind ignores its own selection: every kind is counted.
    expect(counts.kind).toEqual({ word: 3, linker: 1 });
    // The other dimensions count words only.
    expect(counts.topic).toEqual({ work: 1, economy: 1, health: 1 });
    expect(counts.function).toEqual({ importance: 1, opinion: 1, comparison: 1 });
    expect(counts.use).toEqual({
      writing: 3,
      speaking: 1,
      "writing-1": 1,
      "writing-2": 2,
      "speaking-1": 1,
    });
  });

  it("returns an empty page past the last one, with the real total", async () => {
    expect(await service.browse({ kind: "word" }, 2)).toMatchObject({
      items: [],
      total: 3,
      pages: 1,
    });
  });
});

describe("filters on the published content (in memory)", () => {
  let service: LanguageSearchService;

  beforeAll(async () => {
    service = new LanguageSearchService(
      new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
    );
  });

  // Every golden query under every single filter value: the same reading, a subset of the same
  // results in the same order, and every result kept matches. Filters never re-rank.
  it("restricts every golden search without changing its reading or order", async () => {
    let checked = 0;
    for (const golden of GOLDEN_CASES) {
      const plain = (await service.search(golden.query))!;
      const plainIds = ids(plain);
      for (const dimension of FILTER_DIMENSIONS) {
        for (const value of FILTER_VALUES[dimension]) {
          const filters = { [dimension]: value } as SearchFilters;
          const filtered = (await service.search(golden.query, filters))!;
          const label = `${golden.query} + ${dimension}=${value}`;
          expect(filtered.interpretation, label).toEqual(plain.interpretation);
          const kept = ids(filtered);
          expect(
            plainIds.filter((id) => kept.includes(id)),
            label,
          ).toEqual(kept);
          expect(filtered.filters, label).toEqual({
            applied: filters,
            before: plainIds.length,
            after: kept.length,
          });
          for (const facets of await facetsOf(service, kept)) {
            expect(matchesFilters(facets, filters), `${label}: ${facets.senseId}`).toBe(true);
          }
          checked++;
        }
      }
    }
    expect(checked).toBe(GOLDEN_CASES.length * 38);
  });

  it("finds no topics and none of the four new functions in today's content", async () => {
    for (const topic of FILTER_VALUES.topic)
      expect((await service.browse({ topic })).total).toBe(0);
    for (const fn of ["comparison", "decrease", "opinion", "hedging"] as const) {
      expect((await service.browse({ function: fn })).total).toBe(0);
    }
  });

  it("pages through a long browse without gaps or repeats", async () => {
    const first = await service.browse({ use: "writing" });
    expect(first.total).toBeGreaterThan(30);
    const second = await service.browse({ use: "writing" }, 2);
    expect(first.items).toHaveLength(30);
    expect(second.items).toHaveLength(first.total - 30);
    const all = [...first.items, ...second.items].map((item) => item.senseId);
    expect(new Set(all).size).toBe(first.total);
  });
});

/** The repository's facets for these senses, in the same order. */
async function facetsOf(service: LanguageSearchService, senseIds: string[]) {
  const repo = (service as unknown as { repo: MemoryLanguageRepository }).repo;
  const facets = await repo.senseFacets(senseIds);
  return senseIds.map((id) => facets.find((f) => f.senseId === id)!);
}
