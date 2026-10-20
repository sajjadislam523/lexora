import { describe, expect, it } from "vitest";

import {
  FILTER_VALUES,
  finderHref,
  hasFilters,
  isCanonicalFinderParams,
  matchesFilters,
  parseFinderParams,
  searchFiltersSchema,
  type FilterFacets,
} from "./filters";
import { DISCOURSE_FUNCTIONS, ITEM_KINDS, TOPICS } from "./schema/vocabulary";

const general: FilterFacets = {
  kind: "linker",
  functions: ["contrast"],
  topics: [],
  skills: ["writing", "speaking"],
  ieltsTasks: ["writing-2", "speaking-3"],
};

describe("filter values", () => {
  it("use the vocabulary's lists, so there is one taxonomy", () => {
    expect(FILTER_VALUES.kind).toBe(ITEM_KINDS);
    expect(FILTER_VALUES.function).toBe(DISCOURSE_FUNCTIONS);
    expect(FILTER_VALUES.topic).toBe(TOPICS);
    expect(FILTER_VALUES.function).toEqual(
      expect.arrayContaining(["comparison", "decrease", "opinion", "hedging"]),
    );
  });
});

describe("matchesFilters", () => {
  it("matches everything without filters", () => {
    expect(matchesFilters(general, {})).toBe(true);
  });

  it("never matches general language (no topics) to a topic", () => {
    for (const topic of TOPICS) expect(matchesFilters(general, { topic })).toBe(false);
    expect(matchesFilters({ ...general, topics: ["environment"] }, { topic: "environment" })).toBe(
      true,
    );
  });

  it("reads IELTS use as 'used in', by skill or by task", () => {
    expect(matchesFilters(general, { use: "writing" })).toBe(true);
    expect(matchesFilters(general, { use: "speaking" })).toBe(true);
    expect(matchesFilters(general, { use: "writing-2" })).toBe(true);
    expect(matchesFilters(general, { use: "speaking-3" })).toBe(true);
    expect(matchesFilters(general, { use: "writing-1" })).toBe(false);
    expect(matchesFilters({ ...general, skills: ["writing"] }, { use: "speaking" })).toBe(false);
  });

  it("combines dimensions with AND", () => {
    expect(matchesFilters(general, { kind: "linker", function: "contrast", use: "writing" })).toBe(
      true,
    );
    expect(matchesFilters(general, { kind: "linker", function: "addition" })).toBe(false);
    expect(matchesFilters(general, { kind: "word", function: "contrast" })).toBe(false);
  });
});

describe("searchFiltersSchema", () => {
  it.each([
    [{ topic: "sport" }],
    [{ kind: "preposition-pattern" }],
    [{ kind: ["linker"] }],
    [{ kind: "linker' or '1'='1" }],
    [{ function: "contrast;drop table senses" }],
    [{ register: "formal" }],
    [{ use: "task-2" }],
  ])("rejects %j", (input) => {
    expect(searchFiltersSchema.safeParse(input).success).toBe(false);
  });

  it("accepts every value of every dimension", () => {
    for (const kind of ITEM_KINDS) expect(searchFiltersSchema.parse({ kind })).toEqual({ kind });
    for (const fn of DISCOURSE_FUNCTIONS) {
      expect(searchFiltersSchema.parse({ function: fn })).toEqual({ function: fn });
    }
    for (const use of FILTER_VALUES.use)
      expect(searchFiltersSchema.parse({ use })).toEqual({ use });
    for (const topic of TOPICS) expect(searchFiltersSchema.parse({ topic })).toEqual({ topic });
  });
});

describe("Finder URL parameters", () => {
  it("reads a query and filters, with kinds in kebab-case", () => {
    expect(
      parseFinderParams({ q: " important ", kind: "preposition-pattern", topic: "environment" }),
    ).toEqual({
      q: "important",
      filters: { kind: "preposition_pattern", topic: "environment" },
      page: 1,
    });
  });

  it("drops unknown parameters, invalid values and the enum spelling of kinds", () => {
    expect(
      parseFinderParams({
        kind: "preposition_pattern",
        function: "persuasion",
        use: "task-2",
        topic: "<script>",
        utm_source: "mail",
      }),
    ).toEqual({ q: "", filters: {}, page: 1 });
  });

  it("keeps the first valid value of a repeated dimension", () => {
    expect(parseFinderParams({ topic: ["sport", "health", "education"] }).filters).toEqual({
      topic: "health",
    });
    expect(parseFinderParams({ q: ["important", "crucial"] }).q).toBe("important");
  });

  it("treats injection-like values as unknown", () => {
    expect(parseFinderParams({ kind: "linker' OR 1=1 --", topic: "health%27" }).filters).toEqual(
      {},
    );
  });

  it("pages only when browsing (filters without a query)", () => {
    expect(parseFinderParams({ kind: "linker", page: "2" }).page).toBe(2);
    expect(parseFinderParams({ q: "however", kind: "linker", page: "2" }).page).toBe(1);
    expect(parseFinderParams({ page: "2" }).page).toBe(1);
    for (const page of ["0", "-1", "1.5", "02", "abc", "99999"]) {
      expect(parseFinderParams({ kind: "linker", page }).page).toBe(1);
    }
  });

  it("serialises in one canonical order and omits page 1", () => {
    const state = parseFinderParams({
      topic: "health",
      page: "3",
      kind: "linker",
      use: "writing-2",
      function: "contrast",
    });
    expect(finderHref("/explore", state)).toBe(
      "/explore?kind=linker&function=contrast&use=writing-2&topic=health&page=3",
    );
    expect(finderHref("/explore", { ...state, page: 1 })).toBe(
      "/explore?kind=linker&function=contrast&use=writing-2&topic=health",
    );
    expect(
      finderHref("/finder", { q: "a b&c", filters: { kind: "preposition_pattern" }, page: 1 }),
    ).toBe("/finder?q=a+b%26c&kind=preposition-pattern");
    expect(finderHref("/explore", { q: "", filters: {}, page: 1 })).toBe("/explore");
  });

  it("round-trips: parsing a canonical URL gives the same URL back", () => {
    const href = "/explore?kind=linker&function=contrast&use=speaking&topic=work&page=2";
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    const state = parseFinderParams(params);
    expect(finderHref("/explore", state)).toBe(href);
    expect(isCanonicalFinderParams(params, state)).toBe(true);
  });

  it.each([
    [{ topic: "health", kind: "linker" }],
    [{ kind: "linker", page: "1" }],
    [{ kind: ["linker", "word"] }],
    [{ q: " important " }],
    [{ q: "important", page: "2" }],
    [{ kind: "linker", utm_source: "mail" }],
    [{ kind: "preposition_pattern" }],
  ])("finds %j non-canonical", (params) => {
    expect(isCanonicalFinderParams(params, parseFinderParams(params))).toBe(false);
  });

  it("finds an empty or already canonical URL canonical", () => {
    expect(isCanonicalFinderParams({}, parseFinderParams({}))).toBe(true);
    const params = { q: "important", topic: "health" };
    expect(isCanonicalFinderParams(params, parseFinderParams(params))).toBe(true);
  });

  it("knows when any filter is set", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters(undefined)).toBe(false);
    expect(hasFilters({ topic: "health" })).toBe(true);
  });
});
