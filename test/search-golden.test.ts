import { beforeAll, describe, it } from "vitest";

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
});
