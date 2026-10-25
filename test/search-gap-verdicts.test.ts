import { beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { GOLDEN_CASES } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * Context-fit verdicts (Phase 4 Step 4.3) on the published content, in memory: categorical, from
 * authored evidence only, computed before filters, ordered fits → likely fits → depends →
 * unlikely → not supported within each blank and kind. The protected verb-frame answers keep
 * their Phase 3 fit, order and reasons (golden suite and ranking snapshot).
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

/** Each result as `fill{sense}=verdict`. */
const verdicts = (response: SearchResponse | null) =>
  response?.groups.flatMap((group) =>
    group.results.map((r) => `${r.fill?.word}{${r.senseId}}=${r.gapMatch?.verdict}`),
  ) ?? [];

describe("prepositions", () => {
  it.each([
    [
      "responsible ___ the project",
      ["for{responsible-for.duty}=fits", "to{responsible-for.duty}=depends"],
    ],
    [
      "responsible ___ them",
      // Phase 6B: an object pronoun is a noun phrase, so "for" fits too (authored order).
      ["for{responsible-for.duty}=fits", "to{responsible-for.duty}=fits"],
    ],
    [
      "responsible ___ maintaining parks",
      ["for{responsible-for.duty}=fits", "to{responsible-for.duty}=depends"],
    ],
    ["responsible ___", ["for{responsible-for.duty}=depends", "to{responsible-for.duty}=depends"]],
    ["depend ___ others", ["on{depend-on.rely}=likely_fits", "on{depend-on.vary}=depends"]],
    [
      "It depends ___ whether it rains",
      ["on{depend-on.vary}=fits", "on{depend-on.rely}=likely_fits"],
    ],
  ])("%j", async (query, expected) => {
    expect(verdicts(await service.search(query))).toEqual(expected);
  });

  it("marks a preposition that recreates an authored mistake unlikely, and shows the mistake", async () => {
    const response = await service.search("My family is very important ___ me");
    expect(verdicts(response)).toEqual(["to{important.main}=fits", "for{important.main}=unlikely"]);
    const unlikely = response!.groups[0]!.results[1]!;
    expect(unlikely.gapMatch?.signals).toEqual(["authored_mistake"]);
    expect(unlikely.reason).toContain("My family is very important for me.");
    expect(response?.mistakes.map((m) => m.wrong)).toContain("My family is very important for me.");
  });

  it("doesn't take a correct use for the mistake", async () => {
    expect(verdicts(await service.search("This is important ___ young people"))).toEqual([
      "for{important.main}=likely_fits",
      "to{important.main}=depends",
    ]);
  });

  it("never lets another sense's mistake count", async () => {
    // "crucial for me" looks like "important for me", but that mistake belongs to important.
    const response = await service.search("This is crucial ___ me");
    expect(verdicts(response).some((v) => v.endsWith("=unlikely"))).toBe(false);
  });
});

describe("collocations", () => {
  it("fits when the collocation is the learner's words as written", async () => {
    // Content expansion: increase.noun authors "a gradual / marked / sharp increase".
    expect(verdicts(await service.search("There was a ___ increase in cycling"))).toEqual([
      "gradual{increase.noun}=fits",
      "marked{increase.noun}=fits",
      "sharp{increase.noun}=fits",
      "significant{significant.notable}=fits",
      "slight{slightly.small}=fits",
      "substantial{substantial.large}=fits",
    ]);
  });

  it("likely fits when a word matched only through the stemmer", async () => {
    // Step 4.4: an inflection the content authors ("plays" / "play") counts as written, so
    // "Public transport plays a ___ role" is all fits (test/search-context-coverage.test.ts).
    // Content expansion: the other authored "… skills" collocations behave the same way.
    expect(verdicts(await service.search("This job requires ___ skill"))).toEqual([
      "digital{digital.electronic}=likely_fits",
      "essential{essential.necessary}=likely_fits",
      "communication{skill.ability}=likely_fits",
      "transferable{skill.ability}=likely_fits",
      "practical{practical.realistic}=likely_fits",
    ]);
    expect(verdicts(await service.search("This job requires ___ skills"))).toEqual([
      "digital{digital.electronic}=fits",
      "essential{essential.necessary}=fits",
      "communication{skill.ability}=fits",
      "transferable{skill.ability}=fits",
      "practical{practical.realistic}=fits",
    ]);
  });

  it("makes no verdict up where there is no candidate", async () => {
    for (const query of ["a ___ the", "The ___ is high"]) {
      expect((await service.search(query))?.outcome, query).toBe("none");
    }
  });
});

describe("linkers", () => {
  it("depend: the position is right, the relationship isn't read", async () => {
    const response = await service.search("___, it is often slow and crowded");
    const results = response!.groups.flatMap((g) => g.results);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.gapMatch).toMatchObject({
        verdict: "depends",
        signals: ["linker_position", "position:start"],
      });
    }
    // Content expansion: every conjunction authored as joining two clauses.
    expect(
      verdicts(await service.search("My brother loves the city, ___ I prefer the country")),
    ).toEqual([
      "because{because.cause}=depends",
      "since{since.cause}=depends",
      "although{although.concession}=depends",
      "even though{even-though.concession}=depends",
      "whereas{whereas.contrast}=depends",
      "while{while.contrast}=depends",
    ]);
  });

  it("has no candidate, so no verdict, without punctuation or words to link", async () => {
    for (const query of ["___ it is often slow", "It is cheap, ___"]) {
      expect((await service.search(query))?.outcome, query).toBe("none");
    }
  });
});

describe("verb frames keep their Phase 3 answer, with a verdict beside it", () => {
  it.each(
    GOLDEN_CASES.filter((g) => g.intent === "CONTEXT_GAP" && g.fits).map(
      (g) => [g.query, g.fits!] as const,
    ),
  )("%j", async (query, fits) => {
    const results = (await service.search(query))!.groups.flatMap((g) => g.results);
    for (const [term, fit] of Object.entries(fits)) {
      const result = results.find((r) => r.term === term)!;
      expect(result.fit).toBe(fit);
      expect(result.gapMatch?.type).toBe("verb_frame");
      expect(result.gapMatch?.verdict).toBe(
        { fits: "fits", different_preposition: "unlikely", unlikely: "not_supported" }[fit],
      );
    }
  });

  it("likely fits when the sentence has no preposition after the object", async () => {
    expect(verdicts(await service.search("Governments should ___ more money"))).toEqual([
      "allocate{allocate.distribute}=likely_fits",
      "invest{invest.money}=likely_fits",
      "devote{devote.give}=not_supported",
    ]);
  });
});

describe("two blanks", () => {
  it("are judged on their own, as if each were the only blank", async () => {
    const both = verdicts(
      await service.search("Cars are responsible ___ pollution and depend ___ oil"),
    );
    const first = verdicts(await service.search("Cars are responsible ___ pollution"));
    const second = verdicts(await service.search("Cars depend ___ oil"));
    expect(both).toEqual([...first, ...second]);
  });

  it("judge a blank with candidates and leave the other without", async () => {
    // "smog", not "pollution": since the content expansion "pollution levels" reads the second blank.
    const response = await service.search("Cars are responsible ___ smog ___ cities");
    expect(response?.gaps?.map((g) => g.type)).toEqual(["preposition", "unknown"]);
    for (const result of response!.groups.flatMap((g) => g.results)) {
      expect(result.gapMatch?.gap).toBe(0);
    }
  });
});

describe("filters", () => {
  const SINGLE: SearchFilters[] = FILTER_DIMENSIONS.flatMap((dimension) =>
    FILTER_VALUES[dimension].map((value) => ({ [dimension]: value }) as SearchFilters),
  );

  it.each([
    "responsible ___ the project",
    "My family is very important ___ me",
    "Public transport plays a ___ role",
    "Governments should ____ more money into public transportation",
  ])("never change a verdict, only which candidates show, for %j", async (query) => {
    const plain = (await service.search(query))!;
    const byKey = new Map(plain.groups.flatMap((g) => g.results).map((r) => [r.key, r.gapMatch]));
    for (const filters of SINGLE) {
      const filtered = (await service.search(query, filters))!;
      for (const result of filtered.groups.flatMap((g) => g.results)) {
        expect(result.gapMatch, `${query} + ${JSON.stringify(filters)}`).toEqual(
          byKey.get(result.key),
        );
      }
    }
  });
});

describe("ordinary search and determinism", () => {
  it("gives ordinary queries no verdicts", async () => {
    for (const golden of GOLDEN_CASES.filter((g) => g.intent !== "CONTEXT_GAP")) {
      const results = (await service.search(golden.query))?.groups.flatMap((g) => g.results) ?? [];
      expect(
        results.some((r) => r.gapMatch),
        golden.query,
      ).toBe(false);
    }
  });

  it("gives the same verdicts every time", async () => {
    for (const query of [
      "My family is very important ___ me",
      "Public transport plays a ___ role",
    ]) {
      expect(await service.search(query)).toEqual(await service.search(query));
    }
  });
});
