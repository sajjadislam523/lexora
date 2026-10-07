import { describe, expect, it } from "vitest";

import { DEMO_LANGUAGE } from "@/demo/language";

import { FEATURED_SEARCHES, searchHref } from "./examples";
import { PrototypeLanguageRepository } from "./prototype-repository";
import { LanguageSearchService, MAX_QUERY_LENGTH, normaliseQuery } from "./search";

const repository = new PrototypeLanguageRepository();
const search = new LanguageSearchService(repository);

function slugsFor(query: string) {
  const result = search.search(query);
  return result?.kind === "match" ? result.items.map((item) => item.slug) : [];
}

describe("LanguageSearchService", () => {
  it.each([
    ["better word for important", ["significant", "crucial", "fundamental", "considerable"]],
    ["preposition after responsible", ["responsible-for"]],
    ["alternatives to however", ["nevertheless", "on-the-other-hand", "in-contrast", "whereas"]],
    ["I want to express contrast", ["whereas", "in-contrast", "on-the-other-hand", "however"]],
    [
      "natural speaking alternative to furthermore",
      ["on-top-of-that", "whats-more", "furthermore"],
    ],
    [
      "phrase for causing a serious problem",
      ["pose-a-threat", "have-a-detrimental-effect-on", "give-rise-to"],
    ],
  ])("answers the example search “%s”", (query, expected) => {
    expect(slugsFor(query)).toEqual(expected);
  });

  it("finds an item by its exact term, with its related language", () => {
    const result = search.search("Depend on");
    expect(result).toMatchObject({ kind: "match", matchedOn: "depend on" });
    expect(slugsFor("significant")).toEqual(["significant", "crucial", "considerable"]);
  });

  it("finds a known term inside a longer query", () => {
    expect(slugsFor("another way to say crucial")[0]).toBe("crucial");
  });

  it("says which word matched, so results are never presented as interpretation", () => {
    expect(search.search("Better word for IMPORTANT!")).toMatchObject({
      kind: "match",
      matchedOn: "important",
    });
  });

  it("returns an honest no-match, and nothing for an empty query", () => {
    expect(search.search("quantum chromodynamics")).toEqual({
      kind: "no-match",
      query: "quantum chromodynamics",
    });
    expect(search.search("   ")).toBeNull();
    expect(search.search("!!!")).toBeNull();
  });

  it("caps very long queries", () => {
    const result = search.search(`${"a".repeat(MAX_QUERY_LENGTH + 50)} important`);
    expect(result?.query.length).toBe(MAX_QUERY_LENGTH);
  });

  it("normalises case, curly quotes and punctuation", () => {
    expect(normaliseQuery("  What’s MORE, ")).toBe("what's more");
  });
});

describe("PrototypeLanguageRepository", () => {
  it("keeps learner data out of public language items", () => {
    expect(DEMO_LANGUAGE.some((item) => item.status)).toBe(true);
    for (const item of repository.listItems()) expect(item).not.toHaveProperty("status");
  });

  it("has unique slugs, and every example search and relation points at a real item", () => {
    const slugs = repository.listItems().map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const example of repository.listExampleSearches()) {
      for (const slug of example.results) expect(slugs).toContain(slug);
    }
    for (const item of repository.listItems()) {
      for (const relation of item.related ?? []) {
        if (relation.slug) expect(slugs).toContain(relation.slug);
      }
    }
  });

  it("features the six example searches from the brief", () => {
    expect(FEATURED_SEARCHES.map((s) => s.text)).toContain("phrase for causing a serious problem");
    expect(FEATURED_SEARCHES).toHaveLength(6);
  });

  it("builds search URLs for the Finder and Explore", () => {
    expect(searchHref("/explore", "  responsible for ")).toBe("/explore?q=responsible%20for");
    expect(searchHref("/finder", "")).toBe("/finder");
  });
});
