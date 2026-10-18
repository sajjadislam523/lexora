import { beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { GOLDEN_CASES } from "./golden";
import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * Context coverage (Phase 4 Step 4.4, docs/specs/phase-4-step-4-context-coverage.md §13) on the
 * published content, in memory: collocation guards against false Fits, inflected multiword
 * bases, prepositions after a verb frame's object, collocations anchored by any content word,
 * and first words the content authors as inflections. Evidence stays authored; the five
 * verdicts, their precedence and the protected answers stay as they were.
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

const results = (response: SearchResponse | null) =>
  response?.groups.flatMap((group) => group.results) ?? [];

describe("4.4-1 collocation guards", () => {
  it("never offers the learner's own neighbouring word or an inflection of it (A1)", async () => {
    const response = await service.search("Governments must take ___ measures");
    expect(verdicts(response)).toEqual([
      "urgent{take-measures.act}=fits",
      "steps{take-measures.act}=likely_fits",
    ]);
    const fills = results(response).map((r) => r.fill?.word);
    for (const word of ["take", "takes", "took", "taken", "taking", "measures"]) {
      expect(fills).not.toContain(word);
    }
  });

  it("only likely fits when the collocation ends at the blank and a content word follows (A1)", async () => {
    const steps = results(await service.search("Governments must take ___ measures")).find(
      (r) => r.fill?.word === "steps",
    );
    expect(steps?.gapMatch?.signals).toEqual(["collocation", "other_side_unchecked"]);
    expect(steps?.reason).toMatch(/can't check “measures”/);
    // A function word after the blank leaves nothing unchecked.
    expect(verdicts(await service.search("Governments should take ___ to reduce crime"))).toEqual([
      "measures{take-measures.act}=fits",
      "steps{take-measures.act}=fits",
    ]);
  });

  it("offers only the base form's words from an inflected item form (A2, A3)", async () => {
    expect(verdicts(await service.search("Campaigns to raise ___ awareness"))).toEqual([
      "public{raise-awareness.inform}=fits",
    ]);
    // One candidate, not four forms; and only likely fits: "is" before the blank isn't checked.
    expect(verdicts(await service.search("There is ___ awareness"))).toEqual([
      "raise{raise-awareness.inform}=likely_fits",
    ]);
  });
});

describe("4.4-2 inflected multiword bases", () => {
  it.each([
    [
      "Plastic waste poses a threat ___ marine life",
      "Prepositions after “pose a threat”",
      ["to{pose-a-threat.danger}=likely_fits"],
      ["pose a threat for wildlife"],
    ],
    [
      "Tourism plays a crucial role ___ the economy",
      "Prepositions after “play a crucial role”",
      ["in{play-a-crucial-role.main}=fits"],
      ["Tourism plays a crucial role for the economy."],
    ],
    [
      "Public transport plays a crucial role ___ reducing congestion",
      "Prepositions after “play a crucial role”",
      ["in{play-a-crucial-role.main}=fits"],
      ["Tourism plays a crucial role for the economy."],
    ],
    [
      "Schools raised awareness ___ the dangers",
      "Prepositions after “raise awareness”",
      ["about{raise-awareness.inform}=fits", "of{raise-awareness.inform}=fits"],
      ["rise awareness of the problem"],
    ],
    [
      "The government takes measures ___ crime",
      "Prepositions after “take measures”",
      ["against{take-measures.act}=likely_fits"],
      [],
    ],
  ])("%j (B1–B3)", async (query, label, expected, mistakes) => {
    const response = await service.search(query);
    expect(response?.groups.map((g) => g.label)).toEqual([label]);
    expect(verdicts(response)).toEqual(expected);
    expect(response?.mistakes.map((m) => m.wrong)).toEqual(mistakes);
    expect(response?.gaps?.map((g) => g.type)).toEqual(["preposition"]);
  });
});

describe("4.4-3 prepositions after a verb frame's object", () => {
  it("offers the frame's prepositions after an authored object (C1, C2)", async () => {
    const response = await service.search("The council allocated money ___ education");
    expect(response?.groups.map((g) => g.label)).toEqual(["Prepositions after “allocated money”"]);
    expect(verdicts(response)).toEqual([
      "to{allocate.distribute}=likely_fits",
      "for{allocate.distribute}=likely_fits",
    ]);
    const [to] = results(response);
    expect(to?.gapMatch).toEqual({
      gap: 0,
      type: "preposition",
      evidence: "allocate.distribute:money-to",
      verdict: "likely_fits",
      signals: ["frame_object", "noun_unchecked"],
    });
    expect(to?.pattern).toBe("allocate something to / for + noun");
    expect(response?.mistakes.map((m) => m.wrong)).toEqual([
      "The council allocated money in education.",
    ]);
    expect(
      verdicts(await service.search("Governments should invest more money ___ public transport")),
    ).toEqual(["in{invest.money}=likely_fits", "into{invest.money}=likely_fits"]);
  });

  it("checks what follows against the object pattern's complement (C3)", async () => {
    const response = await service.search("She devoted her life ___ helping others");
    expect(response?.groups.map((g) => g.label)).toEqual(["Prepositions after “devoted her life”"]);
    expect(verdicts(response)).toEqual(["to{devote.give}=fits"]);
    expect(results(response)[0]?.gapMatch?.signals).toEqual(["frame_object", "ing_follows"]);
  });

  it("is not supported when the frame doesn't author the object (C4)", async () => {
    const response = await service.search("The council allocated land ___ housing");
    expect(verdicts(response)).toEqual([
      "to{allocate.distribute}=not_supported",
      "for{allocate.distribute}=not_supported",
    ]);
    expect(results(response)[0]?.gapMatch?.signals).toEqual(["frame_object_not_authored"]);
  });

  it("depends when nothing follows the blank (C5)", async () => {
    expect(verdicts(await service.search("The council allocated money ___"))).toEqual([
      "to{allocate.distribute}=depends",
      "for{allocate.distribute}=depends",
    ]);
  });

  it.each([
    "We need to allocate ___ education",
    "They invest it ___ property",
    "The council allocated a lot of money ___ schools",
  ])("needs the verb, then its object, right before the blank: %j", async (query) => {
    expect((await service.search(query))?.outcome).toBe("none");
  });
});

describe("4.4-4 collocations anchored by any content word", () => {
  it.each([
    ["Plastic waste ___ a threat to marine life", ["pose{pose-a-threat.danger}=fits"]],
    [
      "Rising sea levels ___ a serious threat to coastal cities",
      ["pose{pose-a-threat.danger}=fits"],
    ],
    ["Teachers ___ a crucial role in shaping attitudes", ["play{play-a-crucial-role.main}=fits"]],
    ["Teachers ___ a key role", ["play{play-a-crucial-role.main}=fits"]],
    [
      "Screens can ___ a negative effect on sleep",
      ["have{have-a-detrimental-effect-on.harm}=fits"],
    ],
  ])("%j (D1–D3)", async (query, expected) => {
    expect(verdicts(await service.search(query))).toEqual(expected);
  });

  it("keeps a collocation starting at the blank fit after a content word or nothing", async () => {
    for (const query of [
      "Plastic waste ___ a threat to marine life",
      "___ a threat to marine life",
    ]) {
      expect(verdicts(await service.search(query)), query).toEqual([
        "pose{pose-a-threat.danger}=fits",
      ]);
    }
  });

  it.each([
    ["There is ___ a threat", "pose{pose-a-threat.danger}", "is"],
    ["It is ___ a key role", "play{play-a-crucial-role.main}", "is"],
    ["There is ___ awareness", "raise{raise-awareness.inform}", "is"],
    ["Campaigns aim to ___ awareness", "raise{raise-awareness.inform}", "to"],
    ["The report lists the ___ skills", "essential{essential.necessary}", "the"],
  ])(
    "never fits %j: the function word before a collocation's first word is unchecked",
    async (query, candidate, word) => {
      const response = await service.search(query);
      expect(verdicts(response)).toEqual([`${candidate}=likely_fits`]);
      const [result] = results(response);
      expect(result?.gapMatch?.signals).toEqual(["collocation", "other_side_unchecked"]);
      expect(result?.reason).toContain(`Lexora can't check “${word}” before it`);
    },
  );

  it("still fits the same collocations where the words before the blank aren't function words", async () => {
    expect(verdicts(await service.search("Schools should ___ awareness about pollution"))).toEqual([
      "raise{raise-awareness.inform}=fits",
    ]);
    expect(verdicts(await service.search("There has been ___ debate about cars"))).toEqual([
      "considerable{considerable.large}=fits",
    ]);
  });

  it.each([
    "a ___ the",
    "It is ___ that governments act",
    "The ___ is high",
    "There was a ___ decrease",
  ])("still makes nothing up for %j (N1)", async (query) => {
    const response = await service.search(query);
    expect(response?.outcome).toBe("none");
    expect(response?.gaps?.[0]?.type).toBe("unknown");
  });
});

describe("4.4-5 first words the content authors as inflections", () => {
  it.each([
    [
      "The government took ___ to reduce crime",
      ["measures{take-measures.act}=fits", "steps{take-measures.act}=fits"],
    ],
    [
      "Prices rose ___ in 2020",
      [
        "sharply{rise-sharply.increase}=fits",
        "dramatically{rise-sharply.increase}=fits",
        "gradually{rise-sharply.increase}=fits",
        "steadily{rise-sharply.increase}=fits",
      ],
    ],
    [
      "Screen time has a ___ effect on sleep",
      [
        "detrimental{have-a-detrimental-effect-on.harm}=fits",
        "negative{have-a-detrimental-effect-on.harm}=fits",
      ],
    ],
  ])("%j (E1, E2)", async (query, expected) => {
    expect(verdicts(await service.search(query))).toEqual(expected);
  });

  it("marks a match through an authored inflection, and not one as written (E3)", async () => {
    const signals = results(await service.search("Public transport plays a ___ role")).map(
      (r) => `${r.fill?.word}:${r.gapMatch?.signals.join(",")}`,
    );
    expect(signals).toEqual([
      "crucial:collocation",
      "key:collocation,authored_form",
      "major:collocation,authored_form",
      "vital:collocation,authored_form",
      "significant:collocation,authored_form",
    ]);
  });

  it("keeps a match only through the stemmer at likely fits", async () => {
    const [essential] = results(await service.search("This job requires ___ skill"));
    expect(essential?.gapMatch).toMatchObject({
      verdict: "likely_fits",
      signals: ["collocation", "inflected"],
    });
  });
});

describe("what stays as it was", () => {
  it.each([
    [
      "Lung disease can result ___ smoking",
      ["from{result-in.cause}=fits", "in{result-in.cause}=unlikely"],
    ],
    [
      "My family is very important ___ me",
      ["to{important.main}=fits", "for{important.main}=unlikely"],
    ],
    [
      "This is important ___ young people",
      ["for{important.main}=likely_fits", "to{important.main}=depends"],
    ],
  ])("authored mistakes stay conservative: %j (N4)", async (query, expected) => {
    expect(verdicts(await service.search(query))).toEqual(expected);
  });

  it("keeps the protected verb-frame answers, and never joins two blanks (N2, N3)", async () => {
    for (const golden of GOLDEN_CASES.filter((g) => g.intent === "CONTEXT_GAP")) {
      for (const result of results(await service.search(golden.query))) {
        expect(result.gapMatch?.type, golden.query).toBe("verb_frame");
      }
    }
    const response = await service.search("Governments should ___ more money ___ public transport");
    expect(response?.gaps?.map((g) => g.type)).toEqual(["verb_frame", "unknown"]);
  });

  it("judges each blank on its own", async () => {
    const both = verdicts(
      await service.search("The council allocated money ___ education and took ___ to cut costs"),
    );
    const first = verdicts(await service.search("The council allocated money ___ education"));
    const second = verdicts(await service.search("The council took ___ to cut costs"));
    expect(both).toEqual([...first, ...second]);
  });

  it("keeps every linker at depends (N5)", async () => {
    for (const query of ["___, it is often slow and crowded", "Prices rose, ___ demand fell"]) {
      const all = results(await service.search(query));
      expect(all.length, query).toBeGreaterThan(0);
      expect(new Set(all.map((r) => r.gapMatch?.verdict)), query).toEqual(new Set(["depends"]));
    }
  });
});

describe("filters", () => {
  const SINGLE: SearchFilters[] = FILTER_DIMENSIONS.flatMap((dimension) =>
    FILTER_VALUES[dimension].map((value) => ({ [dimension]: value }) as SearchFilters),
  );

  it.each([
    "Governments must take ___ measures",
    "Plastic waste poses a threat ___ marine life",
    "The council allocated money ___ education",
    "The council allocated land ___ housing",
    "Plastic waste ___ a threat to marine life",
    "Prices rose ___ in 2020",
    "The council allocated money ___ education and took ___ to cut costs",
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
});

describe("determinism", () => {
  it("gives the same response every time", async () => {
    for (const query of [
      "Governments must take ___ measures",
      "The council allocated money ___ education",
      "Public transport plays a ___ role",
    ]) {
      expect(await service.search(query), query).toEqual(await service.search(query));
    }
  });
});
