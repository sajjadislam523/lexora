import { describe, expect, it } from "vitest";

import { normaliseQuery } from "../../normalise";
import type { CollocationTemplate, LinkerHit, PatternHit } from "../repository";

import {
  anchorWords,
  baseCandidates,
  collocationCandidates,
  formCandidates,
  gapWindows,
  linkerCandidates,
  linkerSlot,
  orderCandidates,
  prepositionCandidates,
  type GapCandidate,
} from "./candidates";
import { planGaps } from "./reader";

function windowsOf(query: string) {
  const plan = planGaps(query);
  if (plan.kind !== "gap") throw new Error(`not a gap query: ${query}`);
  return gapWindows(normaliseQuery(plan.text), query, plan.blanks);
}
const first = (query: string) => windowsOf(query)[0]!;

const pattern = (over: Partial<PatternHit>): PatternHit => ({
  id: "responsible-for.duty:for",
  senseId: "responsible-for.duty",
  base: "responsible",
  preposition: "for",
  pattern: "be responsible for + noun / -ing",
  complement: "noun_or_ing",
  position: 0,
  ...over,
});

const template = (over: Partial<CollocationTemplate>): CollocationTemplate => ({
  id: "significant.notable:increase",
  senseId: "significant.notable",
  normalized: "a significant increase",
  display: "a significant increase",
  ...over,
});

describe("gapWindows", () => {
  it("reads up to four words on each side, nearest first", () => {
    expect(first("Cars are largely responsible ___ the air pollution in cities")).toMatchObject({
      index: 0,
      before: ["responsible", "largely", "are", "cars"],
      after: ["the", "air", "pollution", "in"],
    });
  });

  it("stops at the other blank", () => {
    const [one, two] = windowsOf("Governments should ___ more money ___ public transport");
    expect(one).toMatchObject({ before: ["should", "governments"], after: ["more", "money"] });
    expect(two).toMatchObject({
      index: 1,
      before: ["money", "more"],
      after: ["public", "transport"],
    });
  });

  it("stops at punctuation next to the blank, and keeps it as linker evidence", () => {
    expect(first("___, it is often slow")).toMatchObject({
      before: [],
      after: [],
      atStart: true,
      commaAfter: true,
      wordsAfter: true,
    });
    expect(first("Prices rose, ___ demand fell")).toMatchObject({
      before: [],
      after: ["demand", "fell"],
      commaBefore: true,
    });
    expect(first("Prices rose. ___ demand fell")).toMatchObject({ before: [], atStart: true });
  });
});

describe("preposition candidates", () => {
  it("tries every run of words that ends right before the blank", () => {
    const window = first("Tourism plays a crucial role ___ the economy");
    expect(baseCandidates(window)).toEqual([
      "role",
      "crucial role",
      "a crucial role",
      "plays a crucial role",
    ]);
    expect(formCandidates(first("It depends ___ the weather"))).toContain("depends on");
  });

  it("keeps a pattern whose base ends the words before the blank, with its own sense", () => {
    const found = prepositionCandidates(first("responsible ___ the project"), [
      { pattern: pattern({}) },
      {
        pattern: pattern({
          id: "responsible-for.duty:to",
          preposition: "to",
          pattern: "be responsible to + person",
        }),
      },
    ]);
    expect(found.map((c) => [c.fill, c.senseId, c.evidence.id])).toEqual([
      ["for", "responsible-for.duty", "responsible-for.duty:for"],
      ["to", "responsible-for.duty", "responsible-for.duty:to"],
    ]);
  });

  it("finds a pattern through an inflected form of its item", () => {
    const found = prepositionCandidates(first("The report focused ___ housing"), [
      {
        pattern: pattern({
          id: "focus-on.attention:on",
          senseId: "focus-on.attention",
          base: "focus",
          preposition: "on",
          pattern: "focus on + noun / -ing",
        }),
        viaForm: "focused on",
      },
    ]);
    expect(found.map((c) => c.fill)).toEqual(["on"]);
  });

  it("ignores a pattern whose preposition comes after an object, not after its base", () => {
    const allocate = pattern({
      id: "allocate.distribute:to",
      senseId: "allocate.distribute",
      base: "allocate",
      preposition: "to",
      pattern: "allocate + noun + to + noun",
    });
    expect(
      prepositionCandidates(first("We should allocate ___ schools"), [{ pattern: allocate }]),
    ).toEqual([]);
  });

  it("ignores a form whose preposition isn't the pattern's", () => {
    const found = prepositionCandidates(first("It depends ___ the weather"), [
      {
        pattern: pattern({
          id: "x",
          base: "depend",
          preposition: "on",
          pattern: "depend on + noun",
        }),
        viaForm: "depends for",
      },
    ]);
    expect(found).toEqual([]);
  });

  it("keeps the mistake the pattern links to, as evidence for later steps", () => {
    const [candidate] = prepositionCandidates(first("responsible ___ the project"), [
      { pattern: pattern({ mistakeId: "responsible-for.duty:of" }) },
    ]);
    expect(candidate?.evidence.mistakeId).toBe("responsible-for.duty:of");
  });
});

describe("collocation candidates", () => {
  it("fills the blank with the one collocation word it lines up with", () => {
    const window = first("There was a ___ increase in cycling");
    expect(anchorWords(window)).toEqual(["increase"]);
    const found = collocationCandidates(window, [template({})]);
    expect(found.map((c) => [c.fill, c.senseId, c.term])).toEqual([
      ["significant", "significant.notable", "a significant increase"],
    ]);
  });

  it("accepts an inflection in the learner's words", () => {
    const found = collocationCandidates(first("Public transport plays a ___ role"), [
      template({
        id: "play-a-crucial-role.main:key",
        senseId: "play-a-crucial-role.main",
        normalized: "play a key role",
        display: "play a key role",
      }),
    ]);
    expect(found.map((c) => c.fill)).toEqual(["key"]);
  });

  it("needs every other word to line up", () => {
    expect(collocationCandidates(first("There was a ___ decrease"), [template({})])).toEqual([]);
    expect(collocationCandidates(first("___ increase"), [template({})])).toEqual([]);
  });

  it("needs a content word next to the blank, and never puts a stopword in it", () => {
    expect(anchorWords(first("a ___ the"))).toEqual([]);
    expect(
      collocationCandidates(first("a ___ the"), [
        template({ normalized: "a few the", display: "x" }),
      ]),
    ).toEqual([]);
    expect(
      collocationCandidates(first("take measures ___ reduce crime"), [
        template({
          id: "take-measures.act:to",
          senseId: "take-measures.act",
          normalized: "take measures to",
          display: "take measures to",
        }),
      ]),
    ).toEqual([]);
  });

  it("prefers a full collocation item over the same words authored under a word", () => {
    const found = collocationCandidates(first("Teachers play a ___ role"), [
      template({
        id: "crucial.essential:role",
        senseId: "crucial.essential",
        itemId: "play-a-crucial-role",
        normalized: "play a crucial role",
        display: "play a crucial role",
      }),
      template({
        id: "form:play-a-crucial-role:play a crucial role",
        senseId: "play-a-crucial-role.main",
        itemId: "play-a-crucial-role",
        normalized: "play a crucial role",
        display: "play a crucial role",
      }),
    ]);
    expect(found.map((c) => c.senseId)).toEqual(["play-a-crucial-role.main"]);
  });

  it("gives the same candidates whatever order the rows come in", () => {
    const rows = [
      template({ id: "b", normalized: "a big increase", display: "a big increase" }),
      template({ id: "a", normalized: "a big increase", display: "a big increase" }),
    ];
    const window = first("There was a ___ increase");
    expect(collocationCandidates(window, rows)).toEqual(
      collocationCandidates(window, [...rows].reverse()),
    );
  });
});

describe("linker candidates", () => {
  const linkers: LinkerHit[] = [
    {
      senseId: "however.contrast",
      headword: "however",
      positions: ["start", "middle", "end"],
      connects: "sentences",
      functions: ["contrast"],
    },
    {
      senseId: "whereas.contrast",
      headword: "whereas",
      positions: ["start", "middle"],
      connects: "clauses",
      functions: ["contrast"],
    },
    {
      senseId: "furthermore.addition",
      headword: "furthermore",
      positions: ["start"],
      connects: "sentences",
      functions: ["addition"],
    },
  ];
  const fills = (query: string) => linkerCandidates(first(query), linkers).map((c) => c.fill);

  it("reads the position from the learner's punctuation", () => {
    expect(linkerSlot(first("___, it is cheap"))).toBe("start");
    expect(linkerSlot(first("Spending, ___, increased"))).toBe("between_commas");
    expect(linkerSlot(first("I love cities, ___ she prefers the country"))).toBe("after_comma");
  });

  it("offers linkers that go in that position and connect what is there", () => {
    expect(fills("___, it is cheap")).toEqual(["however", "furthermore"]);
    expect(fills("Spending, ___, increased")).toEqual(["however"]);
    expect(fills("I love cities, ___ she prefers the country")).toEqual(["whereas"]);
  });

  it("doesn't guess without punctuation, or with nothing to link", () => {
    expect(linkerSlot(first("___ it is cheap"))).toBeUndefined();
    expect(linkerSlot(first("It is cheap, ___"))).toBeUndefined();
    expect(fills("___ it is cheap")).toEqual([]);
  });
});

describe("orderCandidates", () => {
  const candidate = (over: Partial<GapCandidate>): GapCandidate => ({
    gap: 0,
    type: "collocation",
    senseId: "a",
    fill: "x",
    term: "x",
    evidence: { id: "a", display: "x" },
    span: 1,
    ...over,
  });

  it("orders by span, relevance, headword, then evidence id", () => {
    const facts = {
      a: { relevance: "high" as const, headword: "b" },
      b: { relevance: "core" as const, headword: "z" },
      c: { relevance: "core" as const, headword: "a" },
      d: { relevance: "core" as const, headword: "a" },
    };
    const ordered = orderCandidates(
      [
        candidate({ senseId: "a", evidence: { id: "a", display: "" }, span: 3 }),
        candidate({ senseId: "b", evidence: { id: "b", display: "" } }),
        candidate({ senseId: "d", evidence: { id: "d", display: "" } }),
        candidate({ senseId: "c", evidence: { id: "c", display: "" } }),
      ],
      (id) => facts[id as keyof typeof facts],
      [],
    );
    expect(ordered.map((c) => c.senseId)).toEqual(["a", "c", "d", "b"]);
  });

  it("groups linkers by their first function, in vocabulary order", () => {
    const ordered = orderCandidates(
      [candidate({ senseId: "c", type: "linker" }), candidate({ senseId: "a", type: "linker" })],
      (id) => ({
        relevance: "core",
        headword: id,
        firstFunction: id === "a" ? "result" : "addition",
      }),
      ["addition", "result"],
    );
    expect(ordered.map((c) => c.senseId)).toEqual(["c", "a"]);
  });
});
