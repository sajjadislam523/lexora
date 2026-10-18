import { beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { GOLDEN_CASES } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * The gap reader in the search service (Phase 4 Step 4.1) on the published content, in memory:
 * which queries are gap queries, the honest fallback to ordinary search, the `gaps` field, and
 * that filters never change the reading. The protected gap cases are pinned by the golden suite
 * and the ranking snapshot; these tests add what Step 4.1 changes.
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

const terms = (response: SearchResponse | null) =>
  response?.groups.flatMap((group) => group.results.map((result) => result.term)) ?? [];

describe("gap queries", () => {
  it("reports each blank it read, in order, with its marker and type", async () => {
    const one = await service.search(
      "Governments should ____ more money into public transportation",
    );
    expect(one?.gaps).toEqual([{ index: 0, at: 2, marker: "underscore", type: "verb_frame" }]);

    const two = await service.search("Governments should ___ more money ___ public transport");
    expect(two?.interpretation.intent).toBe("CONTEXT_GAP");
    expect(two?.gaps).toEqual([
      { index: 0, at: 2, marker: "underscore", type: "verb_frame" },
      { index: 1, at: 5, marker: "underscore", type: "unknown" },
    ]);
  });

  it("keeps underscore blanks as gap queries even when nothing answers them yet", async () => {
    for (const query of ["responsible ___ the project", "depend ___ others", "I like ___"]) {
      const response = await service.search(query);
      expect(response?.interpretation.intent, query).toBe("CONTEXT_GAP");
      expect(response?.outcome, query).toBe("none");
      expect(response?.gaps?.[0]?.type, query).toBe("unknown");
    }
  });

  it("reads an ellipsis between words as a blank when a verb frame answers it", async () => {
    const response = await service.search(
      "Governments should … more money into public transportation",
    );
    expect(response?.interpretation.intent).toBe("CONTEXT_GAP");
    expect(response?.gaps).toEqual([{ index: 0, at: 2, marker: "ellipsis", type: "verb_frame" }]);
    // The same answer as with underscores.
    const underscores = await service.search(
      "Governments should ____ more money into public transportation",
    );
    expect(response?.groups).toEqual(underscores?.groups);
  });

  it("takes the underscore blank, not an ellipsis used as punctuation", async () => {
    const response = await service.search(
      "Well... Governments should ___ more money into transport",
    );
    expect(response?.gaps).toEqual([{ index: 0, at: 3, marker: "underscore", type: "verb_frame" }]);
    expect(terms(response)).toEqual(["invest", "allocate", "devote"]);
  });
});

describe("honest fallback to ordinary search", () => {
  it.each([
    ["however...", "however"],
    ["however…", "however"],
    ["There is growing concern about ...", "There is growing concern about"],
    ["It is worth noting that...", "It is worth noting that"],
    ["important..........", "important"],
  ])("searches %j as %j", async (query, plain) => {
    const response = await service.search(query);
    const expected = await service.search(plain);
    expect(response?.interpretation).toEqual(expected?.interpretation);
    expect(response?.groups).toEqual(expected?.groups);
    expect(response?.outcome).toBe("results");
    expect(response).not.toHaveProperty("gaps");
    expect(response).not.toHaveProperty("gapNote");
  });

  it("searches as usual when an ellipsis between words has no verb frame", async () => {
    const response = await service.search("The results were ... surprising");
    expect(response?.interpretation.intent).toBe("LOOKUP");
    expect(response).not.toHaveProperty("gaps");
  });

  it("doesn't read more than two blanks, and says why", async () => {
    const response = await service.search("a ___ b ___ c ___ d");
    expect(response?.interpretation.intent).toBe("LOOKUP");
    expect(response?.gapNote).toBe("too_many_gaps");
    expect(response).not.toHaveProperty("gaps");
  });

  it("answers nothing when there are blanks but no words", async () => {
    for (const query of ["____", "___ ___", "… ___ ..."]) {
      expect(await service.search(query), query).toBeNull();
    }
  });

  it("never reads ordinary golden queries as gaps", async () => {
    for (const golden of GOLDEN_CASES.filter((g) => g.intent !== "CONTEXT_GAP")) {
      const response = await service.search(golden.query);
      expect(response, golden.query).not.toHaveProperty("gaps");
      expect(response, golden.query).not.toHaveProperty("gapNote");
    }
  });
});

describe("filters don't change the reading", () => {
  const SINGLE: SearchFilters[] = FILTER_DIMENSIONS.flatMap((dimension) =>
    FILTER_VALUES[dimension].map((value) => ({ [dimension]: value }) as SearchFilters),
  );

  it.each([
    "Governments should ____ more money into public transportation",
    "Governments should ___ more money ___ public transport",
    "responsible ___ the project",
    "however...",
    "a ___ b ___ c ___ d",
  ])("%j reads the same under every filter", async (query) => {
    const plain = (await service.search(query))!;
    for (const filters of SINGLE) {
      const filtered = (await service.search(query, filters))!;
      const label = `${query} + ${JSON.stringify(filters)}`;
      expect(filtered.interpretation, label).toEqual(plain.interpretation);
      expect(filtered.gaps, label).toEqual(plain.gaps);
      expect(filtered.gapNote, label).toEqual(plain.gapNote);
    }
  });
});

describe("determinism", () => {
  it("gives the same response every time", async () => {
    for (const query of [
      "Governments should ___ more money ___ public transport",
      "however...",
      "The results were ... surprising",
      "a ___ b ___ c ___ d",
    ]) {
      expect(await service.search(query), query).toEqual(await service.search(query));
    }
  });
});
