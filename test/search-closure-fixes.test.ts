import { beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * Phase 4 closure fix R-3 (docs/specs/phase-4-final-audit.md, FP-1), on the published content: a
 * collocation's authored `pattern` says what follows it ("substantial evidence that + clause").
 * When the learner's next word is a different function word, the verdict is at most likely fits.
 * It only lowers; matching continuations and everything else are unchanged.
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

const results = (response: SearchResponse | null) =>
  response?.groups.flatMap((group) => group.results) ?? [];
const verdicts = (response: SearchResponse | null) =>
  results(response).map((r) => `${r.fill?.word}=${r.gapMatch?.verdict}`);

describe("a different continuation than the authored one", () => {
  it("makes “substantial evidence” only likely fit before “to”", async () => {
    const response = await service.search("A substantial ___ to the budget");
    const evidence = results(response).find((r) => r.fill?.word === "evidence");
    expect(evidence?.gapMatch).toMatchObject({
      verdict: "likely_fits",
      signals: ["collocation", "continuation_differs"],
    });
    expect(evidence?.reason).toBe(
      "Matches the collocation “substantial evidence”; Lexora’s pattern continues it with “that”, not “to”.",
    );
    expect(verdicts(response)).not.toContain("evidence=fits");
  });

  it.each([
    // "a significant impact on", "an increase in": the authored continuation keeps its fit.
    [
      "There was a significant ___ on cycling",
      ["impact=fits", "difference=likely_fits", "increase=likely_fits", "proportion=likely_fits"],
    ],
    [
      "It had a significant ___ in health",
      ["increase=fits", "difference=likely_fits", "impact=likely_fits", "proportion=likely_fits"],
    ],
    // Content expansion: "a sharp increase in" (increase.noun) follows the same rule as "a sharp rise".
    ["A sharp ___ in prices", ["increase=fits", "rise=fits", "fall=fits"]],
    ["A sharp ___ of prices", ["increase=likely_fits", "rise=likely_fits", "fall=likely_fits"]],
  ])("follows the authored pattern for %j", async (query, expected) => {
    expect(verdicts(await service.search(query))).toEqual(expected);
  });
});

describe("what stays as it was", () => {
  it.each([
    // Content expansion: "a gradual / marked / sharp / slight increase".
    [
      "There was a ___ increase in cycling",
      [
        "gradual=fits",
        "marked=fits",
        "sharp=fits",
        "significant=fits",
        "slight=fits",
        "substantial=fits",
      ],
    ],
    ["The project required a ___ amount of money", ["considerable=fits", "substantial=fits"]],
    ["A ___ amount of people", ["considerable=fits", "substantial=fits"]],
    ["Governments should take ___ to reduce crime", ["measures=fits", "steps=fits"]],
    // Content expansion: "it is clear that" (clear.obvious) joins, also only as likely fits.
    [
      "It is ___ that governments should act",
      ["clear=likely_fits", "crucial=likely_fits", "essential=likely_fits"],
    ],
    ["There is substantial ___ that cars pollute", ["evidence=fits"]],
  ])("%j", async (query, expected) => {
    expect(verdicts(await service.search(query))).toEqual(expected);
  });

  it("leaves the ordinary search for “substantial evidence” alone", async () => {
    const response = await service.search("substantial evidence");
    expect(response?.interpretation.intent).not.toBe("CONTEXT_GAP");
    expect(results(response).some((r) => r.gapMatch)).toBe(false);
    expect(results(response)[0]?.senseId).toBe("substantial.large");
  });
});

describe("filters", () => {
  const SINGLE: SearchFilters[] = FILTER_DIMENSIONS.flatMap((dimension) =>
    FILTER_VALUES[dimension].map((value) => ({ [dimension]: value }) as SearchFilters),
  );

  it.each(["A substantial ___ to the budget", "There was a significant ___ on cycling"])(
    "never change a verdict, only which candidates show, for %j",
    async (query) => {
      const plain = (await service.search(query))!;
      const byKey = new Map(results(plain).map((r) => [r.key, r.gapMatch]));
      for (const filters of SINGLE) {
        const filtered = (await service.search(query, filters))!;
        expect(filtered.interpretation, JSON.stringify(filters)).toEqual(plain.interpretation);
        for (const result of results(filtered)) {
          expect(result.gapMatch, JSON.stringify(filters)).toEqual(byKey.get(result.key));
        }
      }
    },
  );
});
