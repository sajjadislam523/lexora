import { beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { GOLDEN_CASES } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * Context-gap candidates (Phase 4 Step 4.2) on the published content, in memory: prepositions,
 * collocations and linkers from authored structures only, each with its own sense and evidence,
 * one blank at a time, no verdicts. The protected verb-frame answers are pinned by the golden
 * suite and the ranking snapshot.
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

/** Each group's label and its results as `fill{sense}`. */
const shape = (response: SearchResponse | null) =>
  response?.groups.map((group) => [
    group.label,
    group.results.map((r) => `${r.fill?.word}{${r.senseId}}`),
  ]);

describe("preposition gaps", () => {
  it("answers from the patterns of the word before the blank", async () => {
    const response = await service.search("responsible ___ the project");
    expect(response?.interpretation.intent).toBe("CONTEXT_GAP");
    expect(response?.gaps).toEqual([
      { index: 0, at: 1, marker: "underscore", type: "preposition" },
    ]);
    expect(shape(response)).toEqual([
      [
        "Prepositions after “responsible”",
        ["for{responsible-for.duty}", "to{responsible-for.duty}"],
      ],
    ]);
    const [forResult] = response!.groups[0]!.results;
    expect(forResult).toMatchObject({
      term: "responsible for",
      pattern: "be responsible for + noun / -ing",
      gapMatch: { gap: 0, type: "preposition", evidence: "responsible-for.duty:for" },
    });
    expect(forResult).not.toHaveProperty("fit");
  });

  it("keeps each pattern with the sense that owns it", async () => {
    // depend on has two meanings, each with its own "on" pattern.
    expect(shape(await service.search("depend ___ others"))).toEqual([
      ["Prepositions after “depend”", ["on{depend-on.rely}", "on{depend-on.vary}"]],
    ]);
    expect(shape(await service.search("interested ___ the subject"))).toEqual([
      ["Prepositions after “interested”", ["in{interested-in.want}"]],
    ]);
  });

  it("reaches a pattern through an inflected form", async () => {
    expect(shape(await service.search("The report focused ___ housing"))).toEqual([
      ["Prepositions after “focus”", ["on{focus-on.attention}"]],
    ]);
    expect(shape(await service.search("Exercise contributes ___ health"))).toEqual([
      ["Prepositions after “contribute”", ["to{contribute-to.help-cause}"]],
    ]);
  });

  it("brings the mistakes the patterns are authored against, for the fit step", async () => {
    const response = await service.search("responsible ___ the project");
    expect(response?.mistakes.map((m) => m.wrong)).toEqual(["responsible of"]);
  });
});

describe("collocation gaps", () => {
  it("fills the blank with an authored collocation's word", async () => {
    expect(shape(await service.search("There was a ___ increase in cycling"))).toEqual([
      [
        "Collocations with these words",
        ["significant{significant.notable}", "substantial{substantial.large}"],
      ],
    ]);
    expect(shape(await service.search("Governments should take ___ to reduce crime"))).toEqual([
      [
        "Collocations with these words",
        ["measures{take-measures.act}", "steps{take-measures.act}"],
      ],
    ]);
    expect(shape(await service.search("Schools could raise ___ of the dangers"))).toEqual([
      ["Collocations with these words", ["awareness{raise-awareness.inform}"]],
    ]);
  });

  it("never attaches a collocation to another meaning of the same word", async () => {
    const senses = (await service.search("There was a ___ increase in cycling"))!.groups.flatMap(
      (g) => g.results.map((r) => r.senseId),
    );
    expect(senses).toContain("significant.notable");
    expect(senses).not.toContain("significant.statistical");
  });

  it("answers a full collocation item once, with the item", async () => {
    const response = await service.search("Public transport plays a ___ role");
    expect(shape(response)).toEqual([
      [
        "Collocations with these words",
        [
          "crucial{play-a-crucial-role.main}",
          "key{play-a-crucial-role.main}",
          "major{play-a-crucial-role.main}",
          "vital{play-a-crucial-role.main}",
          "significant{significant.notable}",
        ],
      ],
    ]);
  });

  it.each(["a ___ the", "The ___ is high", "There was a ___ decrease"])(
    "makes nothing up for %j",
    async (query) => {
      const response = await service.search(query);
      expect(response?.outcome).toBe("none");
      expect(response?.gaps?.[0]?.type).toBe("unknown");
    },
  );
});

describe("linker gaps", () => {
  it("offers sentence linkers before a comma at the start, grouped by function", async () => {
    const response = await service.search("___, it is often slow and crowded");
    const [label, fills] = shape(response)![0]!;
    expect(label).toBe("Linkers that start a sentence");
    expect(fills).toContain("however{however.contrast}");
    expect(fills).not.toContain("whereas{whereas.contrast}");
    expect(fills![0]).toBe("furthermore{furthermore.addition}");
  });

  it("offers clause linkers after a comma", async () => {
    expect(
      shape(await service.search("My brother loves the city, ___ I prefer the country")),
    ).toEqual([["Linkers that join two clauses", ["whereas{whereas.contrast}"]]]);
    // No collocation is read across the comma ("rose sharply").
    expect(shape(await service.search("Prices rose, ___ demand fell"))).toEqual([
      ["Linkers that join two clauses", ["whereas{whereas.contrast}"]],
    ]);
  });

  it("doesn't guess a linker without punctuation", async () => {
    expect((await service.search("___ it is often slow"))?.outcome).toBe("none");
  });
});

describe("two blanks", () => {
  it("answers each blank on its own, never combining them", async () => {
    const response = await service.search("Cars are responsible ___ pollution and depend ___ oil");
    expect(response?.gaps?.map((g) => g.type)).toEqual(["preposition", "preposition"]);
    expect(shape(response)).toEqual([
      [
        "Gap 1 · Prepositions after “responsible”",
        ["for{responsible-for.duty}", "to{responsible-for.duty}"],
      ],
      ["Gap 2 · Prepositions after “depend”", ["on{depend-on.rely}", "on{depend-on.vary}"]],
    ]);
    for (const group of response!.groups) {
      const gap = group.label!.startsWith("Gap 1") ? 0 : 1;
      for (const result of group.results) expect(result.gapMatch?.gap).toBe(gap);
    }
  });

  it("answers the readable blank and leaves the other unknown", async () => {
    const response = await service.search("Cars are responsible ___ pollution ___ cities");
    expect(response?.gaps?.map((g) => g.type)).toEqual(["preposition", "unknown"]);
    expect(response?.groups.map((g) => g.label)).toEqual([
      "Gap 1 · Prepositions after “responsible”",
    ]);
  });

  it("keeps the verb-frame answer for the first blank and reads the second on its own", async () => {
    const response = await service.search("Governments should ___ more money ___ public transport");
    expect(response?.gaps?.map((g) => g.type)).toEqual(["verb_frame", "unknown"]);
    expect(response?.groups.map((g) => g.label)).toEqual([
      "Fits this sentence",
      "Doesn't fit this sentence",
    ]);
  });

  it("finds nothing when neither blank is readable", async () => {
    expect((await service.search("I ___ that ___ it"))?.outcome).toBe("none");
  });
});

describe("what stays as it was", () => {
  it("adds nothing to the protected verb-frame answers", async () => {
    for (const golden of GOLDEN_CASES.filter((g) => g.intent === "CONTEXT_GAP")) {
      const response = await service.search(golden.query);
      const results = response!.groups.flatMap((g) => g.results);
      expect(
        results.some((r) => r.gapMatch),
        golden.query,
      ).toBe(false);
    }
  });

  it("reads an ellipsis blank that a collocation answers, and falls back when nothing does", async () => {
    expect(shape(await service.search("There was a … increase in cycling"))?.[0]?.[0]).toBe(
      "Collocations with these words",
    );
    expect((await service.search("The results were ... surprising"))?.interpretation.intent).toBe(
      "LOOKUP",
    );
  });
});

describe("filters", () => {
  const SINGLE: SearchFilters[] = FILTER_DIMENSIONS.flatMap((dimension) =>
    FILTER_VALUES[dimension].map((value) => ({ [dimension]: value }) as SearchFilters),
  );

  it.each([
    "responsible ___ the project",
    "There was a ___ increase in cycling",
    "___, it is often slow and crowded",
    "Cars are responsible ___ pollution and depend ___ oil",
  ])("never change how %j is read, only which candidates show", async (query) => {
    const plain = (await service.search(query))!;
    const keys = plain.groups.flatMap((g) => g.results.map((r) => r.key));
    for (const filters of SINGLE) {
      const filtered = (await service.search(query, filters))!;
      const label = `${query} + ${JSON.stringify(filters)}`;
      expect(filtered.interpretation, label).toEqual(plain.interpretation);
      expect(filtered.gaps, label).toEqual(plain.gaps);
      const kept = filtered.groups.flatMap((g) => g.results.map((r) => r.key));
      expect(
        keys.filter((key) => kept.includes(key)),
        label,
      ).toEqual(kept);
    }
  });

  it("filters candidates by the sense they belong to", async () => {
    const words = await service.search("responsible ___ the project", { kind: "word" });
    expect(words?.filters).toEqual({ applied: { kind: "word" }, before: 2, after: 0 });
    const patterns = await service.search("responsible ___ the project", {
      kind: "preposition_pattern",
    });
    expect(patterns?.filters?.after).toBe(2);
  });
});

describe("determinism", () => {
  it("gives the same response every time", async () => {
    for (const query of [
      "Public transport plays a ___ role",
      "___, it is often slow and crowded",
      "Cars are responsible ___ pollution and depend ___ oil",
    ]) {
      expect(await service.search(query), query).toEqual(await service.search(query));
    }
  });
});
