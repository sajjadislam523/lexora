import { describe, expect, it } from "vitest";

import { rank, relationFit, type Candidate } from "./rank";
import type { SearchResult } from "./types";

const candidate = (
  term: string,
  overrides: Partial<Candidate> = {},
  result: Partial<SearchResult> = {},
): Candidate => ({
  result: {
    key: term,
    senseId: term,
    slug: term,
    term,
    headword: term,
    kind: "word",
    definition: "",
    bestWhen: "",
    registers: ["neutral"],
    skills: ["writing"],
    reason: "test",
    ...result,
  },
  tier: 3,
  weight: 1,
  relevance: "core",
  typePriority: 0,
  position: 0,
  ...overrides,
});

const terms = (results: SearchResult[]) => results.map((r) => r.term);

describe("rank (Phase 6B)", () => {
  it("puts a word of the term's class before a heavier relation of another class", () => {
    const ranked = rank([
      candidate("in my opinion", { weight: 3, classFit: 1 }),
      candidate("argue", { weight: 1, classFit: 0 }),
    ]);
    expect(terms(ranked)).toEqual(["argue", "in my opinion"]);
  });

  it("puts what the learner asked for before editorial weight", () => {
    const ranked = rank(
      [
        candidate("effective", { weight: 3 }),
        candidate("beneficial", { weight: 1 }, { registers: ["formal"] }),
      ],
      ["formal"],
    );
    expect(terms(ranked)).toEqual(["beneficial", "effective"]);
  });

  it("prefers a relation that states the register when both fit it", () => {
    const relation = new Map([["positive", "more_formal" as const]]);
    const ranked = rank(
      [
        candidate("effective", { weight: 3 }, { registers: ["academic"] }),
        candidate("positive", { weight: 1 }, { registers: ["academic"] }),
      ],
      ["formal"],
      (c) => relation.get(c.result.term),
    );
    expect(terms(ranked)).toEqual(["positive", "effective"]);
  });

  it("keeps weight first without a request", () => {
    const ranked = rank([candidate("key", { weight: 1 }), candidate("significant", { weight: 3 })]);
    expect(terms(ranked)).toEqual(["significant", "key"]);
  });
});

describe("relationFit", () => {
  it.each([
    [["formal"], "more_formal", 1],
    [["academic"], "more_formal", 1],
    [["natural", "informal"], "more_natural", 2],
    [["formal"], "synonym", 0],
    [["speaking"], "more_natural", 0],
  ] as const)("%j with %s → %d", (modifiers, type, fit) => {
    expect(relationFit(modifiers, type)).toBe(fit);
  });
});
