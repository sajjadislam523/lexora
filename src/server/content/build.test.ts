import { describe, expect, it } from "vitest";

import { fixtureContent, sense, toFiles, type FixtureContent } from "../../../test/content-fixture";

import { buildRows, contentChecksum, frameDisplay, frameHead, highlightSpans } from "./build";
import { validateContent, type ValidatedContent } from "./validate";

function validated(mutate?: (content: FixtureContent) => void) {
  const content = fixtureContent();
  mutate?.(content);
  const result = validateContent(toFiles(content));
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
  return result.content;
}

describe("buildRows", () => {
  const rows = buildRows(validated());

  it("uses the authored keys as IDs", () => {
    expect(rows.senses.map((row) => row.id)).toContain("important.main");
    expect(rows.examples.map((row) => row.id)).toContain("important.main:ex1");
    expect(rows.prepositionPatterns[0]).toMatchObject({
      id: "important.main:to",
      mistakeId: "important.main:for-me",
      baseNormalized: "important",
    });
    expect(rows.examples.find((row) => row.id === "important.main:ex2")).toMatchObject({
      prepositionPatternId: "important.main:to",
      sourceId: "lexora-editorial",
    });
  });

  it("writes the inverse of every authored relation", () => {
    expect(rows.relations).toEqual([
      expect.objectContaining({
        fromSenseId: "important.main",
        toSenseId: "crucial.essential",
        type: "stronger",
        isInverse: false,
        weight: 3,
      }),
      expect.objectContaining({
        fromSenseId: "crucial.essential",
        toSenseId: "important.main",
        type: "weaker",
        isInverse: true,
        weight: 3,
      }),
    ]);
  });

  it("marks one default form per item", () => {
    const analyse = rows.forms.filter((form) => form.itemId === "analyse");
    expect(analyse.map((form) => [form.normalized, form.isDefault, form.region])).toEqual([
      ["analyse", true, "gb"],
      ["analyze", false, "us"],
    ]);
  });

  it("orders intent entries across groups", () => {
    expect(rows.intentEntries).toEqual([
      {
        intentId: "express-contrast",
        senseId: "however.contrast",
        groupLabel: "Between sentences",
        position: 0,
        fitNote: "general contrast",
      },
    ]);
  });
});

describe("highlightSpans", () => {
  it("finds each highlight case-insensitively, in text order", () => {
    const text = "However, prices rose; however, demand fell.";
    expect(highlightSpans(text, ["demand", "however"])).toEqual([
      { start: 0, end: 7 },
      { start: 31, end: 37 },
    ]);
  });
});

describe("frames", () => {
  const parts = [
    { text: "invest", head: true },
    { slot: "object" as const, fillers: ["money"] },
    { text: "in", also: ["into"] },
    { slot: "noun" as const },
  ];

  it("displays literal parts, alternatives and slots", () => {
    expect(frameDisplay(parts)).toBe("invest something in / into + noun");
  });

  it("is found by its head word, or else its first literal part", () => {
    expect(frameHead(parts)).toBe("invest");
    expect(frameHead([{ text: "There is growing concern about" }, { slot: "noun" }])).toBe(
      "there is growing concern about",
    );
  });
});

describe("contentChecksum", () => {
  it("is stable for the same content and changes with it", () => {
    const a: ValidatedContent = validated();
    expect(contentChecksum(a)).toBe(contentChecksum(validated()));
    const b = validated((c) => {
      sense(c, "crucial").best_when = "When an outcome depends on it.";
    });
    expect(contentChecksum(b)).not.toBe(contentChecksum(a));
  });
});
