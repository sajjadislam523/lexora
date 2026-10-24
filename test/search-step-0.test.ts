import { beforeAll, describe, expect, it } from "vitest";

import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { checkGolden } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";
import { NOT_TRIGGERS, STEP_0_CASES } from "./step-0-cases";

/** Phase 5 Step 0 search fixes on the published content, in memory. */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

/** The answer without the fields that echo the query itself. */
const answer = (response: SearchResponse | null) => {
  const { query: _query, normalised: _normalised, ...rest } = response!;
  return rest;
};

describe("Step 0 search fixes (in memory)", () => {
  it.each(STEP_0_CASES.map((golden) => [golden.query, golden] as const))(
    "%s",
    async (_, golden) => {
      await checkGolden(service, golden);
    },
  );

  it.each(NOT_TRIGGERS)("reads %j as an ordinary lookup, not an intent", async (query) => {
    expect((await service.search(query))?.interpretation.intent).toBe("LOOKUP");
  });

  it.each([
    ["express contrast", "I want to express contrast"],
    ["describe an increase", "I want to describe an increase"],
    ["give an example", "how do I give an example"],
  ])("answers %j exactly as %j", async (bare, prefixed) => {
    expect(answer(await service.search(bare))).toEqual(answer(await service.search(prefixed)));
  });

  it("filters a bare intent query as it filters the prefixed one", async () => {
    for (const filters of [{ kind: "linker" }, { use: "speaking" }] as const) {
      expect(answer(await service.search("express contrast", filters))).toEqual(
        answer(await service.search("I want to express contrast", filters)),
      );
    }
  });
});
