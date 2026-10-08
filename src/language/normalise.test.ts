import { describe, expect, it } from "vitest";

import { MAX_QUERY_LENGTH, normaliseQuery, normaliseTerm } from "./normalise";

describe("normaliseQuery", () => {
  it.each([
    ["Better word for IMPORTANT", "better word for important"],
    ["  responsible   of  ", "responsible of"],
    ["What’s more,", "what's more"],
    ["Ｆｕｌｌ ｗｉｄｔｈ", "full width"],
    ["“However”, he said.", "however he said"],
    ["responsible + ?", "responsible + ?"],
    ["well-known", "well-known"],
    ["'quoted' - dash", "quoted dash"],
    ["café", "café"],
    ["Task 1 chart", "task 1 chart"],
  ])("%j → %j", (input, expected) => {
    expect(normaliseQuery(input)).toBe(expected);
  });

  it.each([
    ["Governments should ____ more money", "governments should ___ more money"],
    ["should __ more", "should ___ more"],
    ["should … more", "should ___ more"],
    ["should ... more", "should ___ more"],
    ["should______more", "should ___ more"],
  ])("turns gap markers into one token: %j", (input, expected) => {
    expect(normaliseQuery(input)).toBe(expected);
  });

  it("drops a single underscore, which is not a gap marker", () => {
    expect(normaliseQuery("snake_case")).toBe("snake case");
  });

  it("cuts long queries instead of rejecting them", () => {
    expect(normaliseQuery("a ".repeat(300)).length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });

  it("returns an empty string for punctuation only", () => {
    expect(normaliseQuery(" !!! ")).toBe("");
    expect(normaliseQuery("?!")).toBe("");
    expect(normaliseQuery("+ ?")).toBe("");
  });
});

describe("normaliseTerm", () => {
  it("drops display-only gap markers from authored text", () => {
    expect(normaliseTerm("There is growing concern about …")).toBe(
      "there is growing concern about",
    );
  });

  it("matches the query form of the same text", () => {
    for (const text of ["On the other hand,", "what's more", "Analyse"]) {
      expect(normaliseTerm(text)).toBe(normaliseQuery(text));
    }
  });
});
