import { beforeAll, describe, expect, it } from "vitest";

import { LanguageSearchService } from "@/language/search/service";
import { buildRows } from "@/server/content/build";

import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * F3 (Phase 4, docs/specs/phase-4-step-4-5-context-gap-extensions.md §9): "amount" with a plural
 * noun such as "people" is authored as a countability mistake for considerable and substantial,
 * as it already was for significant. Content only — the engine is unchanged.
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

describe("the countability mistake", () => {
  it.each([
    ["a considerable amount of people", "considerable.large", "a considerable number of people"],
    ["a substantial amount of people", "substantial.large", "a substantial number of people"],
    ["a significant amount of people", "significant.notable", "a significant number of people"],
  ])("is found for %j, with its correction", async (query, senseId, right) => {
    const response = await service.search(query);
    expect(response?.groups.flatMap((g) => g.results.map((r) => r.senseId))).toEqual([senseId]);
    expect(response?.mistakes).toEqual([
      {
        wrong: query,
        right,
        explanation:
          'Use "number" with countable nouns such as people and cars, and "amount" with uncountable nouns such as money and time.',
      },
    ]);
  });

  it("isn't claimed for the correct uses", async () => {
    for (const query of [
      "a considerable amount of money",
      "a substantial amount of time",
      "a considerable number of people",
    ]) {
      expect(
        (await service.search(query))?.mistakes.map((m) => m.wrong),
        query,
      ).not.toContain(`${query.split(" ").slice(0, 2).join(" ")} amount of people`);
    }
  });
});

describe("the gap answer (a known limitation, unchanged)", () => {
  it('still offers considerable and substantial for "A ___ amount of people"', async () => {
    // The mistake's wrong word is the learner's "amount", not the word in the gap, so the
    // conservative mistake rule (CC-D9) doesn't count it against these candidates. Changing that
    // is an engine decision for the Phase 4 final audit, not content.
    const response = await service.search("A ___ amount of people");
    expect(
      response?.groups.flatMap((g) =>
        g.results.map((r) => `${r.fill?.word}=${r.gapMatch?.verdict}`),
      ),
    ).toEqual(["considerable=fits", "substantial=fits"]);
  });
});
