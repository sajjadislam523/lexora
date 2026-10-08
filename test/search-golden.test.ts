import { beforeAll, describe, expect, it } from "vitest";

import { EXAMPLE_SEARCHES } from "@/language/examples";
import { LanguageSearchService } from "@/language/search/service";
import { buildRows } from "@/server/content/build";

import { checkGolden, GOLDEN_CASES } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/** The golden suite over content/ in memory: fast, no database. */
describe("golden search suite (in memory)", () => {
  let service: LanguageSearchService;

  beforeAll(async () => {
    service = new LanguageSearchService(
      new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
    );
  });

  it.each(GOLDEN_CASES.map((golden) => [golden.query, golden] as const))(
    "%s",
    async (_, golden) => {
      await checkGolden(service, golden);
    },
  );

  it.each(EXAMPLE_SEARCHES.map((example) => [example.text] as const))(
    "example search %j finds real results",
    async (text) => {
      const response = await service.search(text);
      expect(response?.outcome).toBe("results");
    },
  );
});
