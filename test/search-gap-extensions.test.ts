import { beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { GOLDEN_CASES } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * Context-gap extensions (Phase 4 Step 4.5, docs/specs/phase-4-step-4-5-context-gap-extensions.md
 * §21) on the published content, in memory: the precision repairs R-1 and R-2, one authored
 * structure filling both blanks, and "It is ___ that" capped at likely fits. Step 4.5 lowers
 * verdicts or adds hedged answers; it never raises one.
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

const results = (response: SearchResponse | null) =>
  response?.groups.flatMap((group) => group.results) ?? [];

/** Each single-blank result as `fill{sense}=verdict`. */
const verdicts = (response: SearchResponse | null) =>
  results(response).map((r) => `${r.fill?.word}{${r.senseId}}=${r.gapMatch?.verdict}`);

/** The pairs as `head … preposition{sense}=verdict`, in order. */
const pairs = (response: SearchResponse | null) =>
  results(response)
    .filter((r) => r.gapMatch?.gaps)
    .map((r) => `${r.fill?.word} … ${r.fill?.preposition}{${r.senseId}}=${r.gapMatch?.verdict}`);

describe("R-1: a form of be or have before a collocation's first word", () => {
  it.each([
    ["It was ___ a key role", "play{play-a-crucial-role.main}"],
    ["They were ___ a threat", "pose{pose-a-threat.danger}"],
    ["It has been ___ a threat", "pose{pose-a-threat.danger}"],
    ["Prices have ___ sharply", "rise{rise-sharply.increase}"],
  ])("never fits %j", async (query, candidate) => {
    const response = await service.search(query);
    expect(verdicts(response)).toEqual([`${candidate}=likely_fits`]);
    expect(results(response)[0]?.gapMatch?.signals).toEqual([
      "collocation",
      "other_side_unchecked",
    ]);
  });

  it("keeps the same collocations fitting after a modal, a noun or nothing", async () => {
    for (const query of ["This will ___ a threat", "Plastic waste ___ a threat", "___ a threat"]) {
      expect(verdicts(await service.search(query)), query).toEqual([
        "pose{pose-a-threat.danger}=fits",
      ]);
    }
  });
});

describe("R-2: a content word after a collocation that ends on a content word", () => {
  it('only likely fits "Schools ___ awareness campaigns"', async () => {
    const [raise] = results(await service.search("Schools ___ awareness campaigns"));
    expect(raise?.gapMatch).toMatchObject({
      verdict: "likely_fits",
      signals: ["collocation", "other_side_unchecked"],
    });
    expect(raise?.reason).toContain("Lexora can't check “campaigns” after it");
  });

  it('only likely fits "Teachers play a ___ role models"', async () => {
    expect(verdicts(await service.search("Teachers play a ___ role models"))).toEqual([
      "crucial{play-a-crucial-role.main}=likely_fits",
      "key{play-a-crucial-role.main}=likely_fits",
      "major{play-a-crucial-role.main}=likely_fits",
      "vital{play-a-crucial-role.main}=likely_fits",
      "significant{significant.notable}=likely_fits",
    ]);
  });

  // Since the content expansion other collocations answer too, some only as likely fits ("harmful
  // effects" against "effect"); the ones R3 is about keep fitting.
  it.each([
    ["Screen time has a ___ effect on sleep", ["detrimental", "negative"]],
    ["Screens can ___ a negative effect on sleep", ["have"]],
    ["There was a ___ increase in cycling", ["significant", "substantial"]],
    ["Public transport plays a ___ role", ["crucial", "key", "vital", "major"]],
  ])("keeps %j fitting (R3)", async (query, words) => {
    const found = results(await service.search(query));
    for (const word of words) {
      expect(found.find((r) => r.fill?.word === word)?.gapMatch?.verdict, word).toBe("fits");
    }
  });
});

describe("one authored structure for both blanks (G5-D1, G5-D2)", () => {
  it("pairs each verb frame's head with its own prepositions, first (J1)", async () => {
    const response = await service.search("Governments should ___ more money ___ public transport");
    expect(pairs(response)).toEqual([
      "invest … in{invest.money}=likely_fits",
      "invest … into{invest.money}=likely_fits",
      "allocate … to{allocate.distribute}=likely_fits",
      "allocate … for{allocate.distribute}=likely_fits",
    ]);
    expect(response?.groups.map((g) => g.label)).toEqual([
      "Both gaps",
      "Fits this sentence",
      "Doesn't fit this sentence",
    ]);
    const [first] = results(response);
    expect(first).toMatchObject({
      key: "invest.money:money-in:gaps:invest:in",
      fill: { word: "invest", preposition: "in" },
      pattern: "invest something in / into + noun",
      gapMatch: {
        gap: 0,
        gaps: [0, 1],
        type: "verb_frame",
        evidence: "invest.money:money-in",
        verdict: "likely_fits",
        signals: ["joint", "frame_object", "noun_unchecked"],
      },
    });
  });

  it("leaves the protected first-blank answer exactly as it was (J1)", async () => {
    const response = await service.search("Governments should ___ more money ___ public transport");
    const protectedGroups = response!.groups.slice(1);
    expect(
      protectedGroups.flatMap((g) => g.results.map((r) => `${r.fill?.word}:${r.fit}`)),
    ).toEqual(["allocate:fits", "invest:fits", "devote:unlikely"]);
    for (const result of protectedGroups.flatMap((g) => g.results)) {
      expect(result.gapMatch?.gaps).toBeUndefined();
    }
  });

  it.each([
    [
      "People should ___ more attention ___ environmental problems",
      ["devote … to{devote.give}=likely_fits"],
    ],
    [
      "Schools should ___ more time ___ the curriculum",
      [
        "invest … in{invest.money}=fits",
        "invest … into{invest.money}=fits",
        "allocate … to{allocate.distribute}=fits",
        "allocate … for{allocate.distribute}=fits",
        "devote … to{devote.give}=fits",
      ],
    ],
    [
      "Teachers ___ a crucial role ___ shaping attitudes",
      ["play … in{play-a-crucial-role.main}=fits"],
    ],
    ["Plastic waste ___ a threat ___ marine life", ["pose … to{pose-a-threat.danger}=likely_fits"]],
    [
      "Schools should ___ awareness ___ the dangers",
      ["raise … about{raise-awareness.inform}=fits", "raise … of{raise-awareness.inform}=fits"],
    ],
    ["Governments must ___ measures ___ crime", ["take … against{take-measures.act}=likely_fits"]],
    ["The policy ___ rise ___ protests", ["give … to{give-rise-to.cause}=likely_fits"]],
  ])("%j (J2–J9)", async (query, expected) => {
    expect(pairs(await service.search(query))).toEqual(expected);
  });

  it("keeps the independent groups after the pairs (J5, J9)", async () => {
    const play = await service.search("Teachers ___ a crucial role ___ shaping attitudes");
    expect(play?.groups.map((g) => g.label)).toEqual([
      "Both gaps · play … in",
      "Gap 1 · Collocations with these words",
    ]);
    const rise = await service.search("The policy ___ rise ___ protests");
    // Content expansion: "policy on" and "rise in / by / to" answer each gap on its own too.
    expect(rise?.groups.map((g) => g.label)).toEqual([
      "Both gaps · give … to",
      "Gap 1 · Prepositions after “policy”",
      "Gap 2 · Prepositions after “rise”",
      "Gap 2 · Collocations with these words",
    ]);
    // The second blank's first candidate is now a preposition ("rise in").
    expect(rise?.gaps?.map((g) => g.type)).toEqual(["preposition", "preposition"]);
  });

  it.each([
    "The council ___ land ___ housing",
    "___ contrast ___ their parents",
    "Cars are responsible ___ pollution and depend ___ oil",
    "Governments should ___ more money each year ___ transport",
    "Governments should ___ more money, ___ transport",
    "Rising sea levels ___ a serious threat ___ coastal cities",
  ])("pairs nothing for %j (J4, J10–J12)", async (query) => {
    expect(pairs(await service.search(query))).toEqual([]);
  });

  it("never pairs a head with another structure's preposition", async () => {
    for (const pair of pairs(
      await service.search("Governments should ___ resources ___ public services"),
    )) {
      expect(pair).toMatch(/^(invest … (in|into)|allocate … (to|for)|devote … to)\{/);
    }
  });

  it("hedges a pair after a function word or a form of be/have", async () => {
    for (const query of [
      "We need to ___ more money ___ schools",
      "They have ___ money ___ schools",
    ]) {
      for (const result of results(await service.search(query)).filter((r) => r.gapMatch?.gaps)) {
        expect(result.gapMatch?.verdict, query).toBe("likely_fits");
        expect(result.gapMatch?.signals, query).toContain("other_side_unchecked");
      }
    }
  });

  it("answers one blank and three blanks as before", async () => {
    expect(
      pairs(await service.search("Governments should invest more money ___ public transport")),
    ).toEqual([]);
    const three = await service.search("a ___ b ___ c ___ d");
    expect(three?.gapNote).toBe("too_many_gaps");
    expect(pairs(three)).toEqual([]);
  });
});

describe("window isolation", () => {
  it("never reads one blank's words past the other blank", async () => {
    // Gap 1 alone ("___ a crucial role") and gap 2 alone ("a threat ___") answer as they do
    // when the other blank isn't there.
    const both = await service.search("Teachers ___ a crucial role ___ shaping attitudes");
    const firstAlone = await service.search("Teachers ___ a crucial role");
    expect(
      both!.groups
        .filter((g) => g.label?.startsWith("Gap 1"))
        .flatMap((g) => g.results.map((r) => r.fill?.word)),
    ).toEqual(results(firstAlone).map((r) => r.fill?.word));
    const rise = await service.search("The policy ___ rise ___ protests");
    expect(
      rise!.groups
        .filter((g) => g.label?.startsWith("Gap 2"))
        .flatMap((g) => g.results.map((r) => r.fill?.word)),
    ).toEqual(results(await service.search("rise ___ protests")).map((r) => r.fill?.word));
  });
});

describe('"It is ___ that" (G5-D4)', () => {
  it("offers the authored collocations, never as fits", async () => {
    const response = await service.search("It is ___ that governments should act");
    // Content expansion: "it is clear that" (clear.obvious) joins.
    expect(verdicts(response)).toEqual([
      "clear{clear.obvious}=likely_fits",
      "crucial{crucial.essential}=likely_fits",
      "essential{essential.necessary}=likely_fits",
    ]);
    for (const result of results(response)) {
      expect(result.gapMatch?.signals).toEqual(["collocation", "function_words_only"]);
    }
  });

  it("doesn't claim fits for a cleft either", async () => {
    expect(
      new Set(
        results(await service.search("It is ___ that I like most")).map((r) => r.gapMatch?.verdict),
      ),
    ).toEqual(new Set(["likely_fits"]));
  });

  it.each(["It's ___ that governments act", "It is ___ to consider the costs", "a ___ the"])(
    "answers nothing for %j",
    async (query) => {
      expect((await service.search(query))?.outcome).toBe("none");
    },
  );
});

describe("what stays as it was", () => {
  it("keeps the six protected verb-frame answers", async () => {
    for (const golden of GOLDEN_CASES.filter((g) => g.intent === "CONTEXT_GAP")) {
      for (const result of results(await service.search(golden.query))) {
        expect(result.gapMatch?.type, golden.query).toBe("verb_frame");
        expect(result.gapMatch?.gaps, golden.query).toBeUndefined();
      }
    }
  });

  it("gives ordinary queries no pairs and no verdicts", async () => {
    for (const golden of GOLDEN_CASES.filter((g) => g.intent !== "CONTEXT_GAP")) {
      expect(
        results(await service.search(golden.query)).some((r) => r.gapMatch),
        golden.query,
      ).toBe(false);
    }
  });
});

describe("filters", () => {
  const SINGLE: SearchFilters[] = FILTER_DIMENSIONS.flatMap((dimension) =>
    FILTER_VALUES[dimension].map((value) => ({ [dimension]: value }) as SearchFilters),
  );

  it.each([
    "Governments should ___ more money ___ public transport",
    "Teachers ___ a crucial role ___ shaping attitudes",
    "The policy ___ rise ___ protests",
    "It is ___ that governments should act",
    "It was ___ a key role",
    "Schools ___ awareness campaigns",
  ])("never change the reading or a verdict, only which candidates show, for %j", async (query) => {
    const plain = (await service.search(query))!;
    const byKey = new Map(results(plain).map((r) => [r.key, r.gapMatch]));
    const keys = [...byKey.keys()];
    for (const filters of SINGLE) {
      const filtered = (await service.search(query, filters))!;
      const label = `${query} + ${JSON.stringify(filters)}`;
      expect(filtered.interpretation, label).toEqual(plain.interpretation);
      expect(filtered.gaps, label).toEqual(plain.gaps);
      const kept = results(filtered).map((r) => r.key);
      expect(
        keys.filter((key) => kept.includes(key)),
        label,
      ).toEqual(kept);
      for (const result of results(filtered)) {
        expect(result.gapMatch, label).toEqual(byKey.get(result.key));
      }
    }
  });

  it("keeps or removes a pair whole, by its sense", async () => {
    const words = await service.search("Governments should ___ more money ___ public transport", {
      kind: "word",
    });
    expect(pairs(words).length).toBeGreaterThan(0);
    const linkers = await service.search("Governments should ___ more money ___ public transport", {
      kind: "linker",
    });
    expect(pairs(linkers)).toEqual([]);
  });
});

describe("determinism", () => {
  it("gives the same response every time", async () => {
    for (const query of [
      "Governments should ___ more money ___ public transport",
      "The policy ___ rise ___ protests",
      "It is ___ that governments should act",
    ]) {
      expect(await service.search(query), query).toEqual(await service.search(query));
    }
  });
});
