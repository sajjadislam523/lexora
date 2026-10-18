import { describe, expect, it } from "vitest";

import { MAX_QUERY_LENGTH } from "../../normalise";

import { MAX_GAPS, planGaps } from "./reader";

const blanks = (query: string) => {
  const plan = planGaps(query);
  return plan.kind === "gap" ? plan.blanks.map((blank) => blank.marker) : plan.kind;
};

describe("planGaps", () => {
  it("leaves a query without markers exactly as it is", () => {
    for (const query of ["important", "preposition after responsible", "a? b! c, d."]) {
      expect(planGaps(query)).toEqual({ kind: "ordinary", text: query });
    }
  });

  describe("underscores", () => {
    it("always mark a blank, one or two", () => {
      expect(blanks("responsible ___ the project")).toEqual(["underscore"]);
      expect(blanks("Governments should ____ more money into transport")).toEqual(["underscore"]);
      expect(blanks("Governments should ___ more money ___ public transport")).toEqual([
        "underscore",
        "underscore",
      ]);
      expect(blanks("I like ___")).toEqual(["underscore"]);
      expect(blanks("___ is important")).toEqual(["underscore"]);
    });

    it("keep the query as typed when every marker is a blank", () => {
      const query = "depend ___ others";
      expect(planGaps(query)).toEqual({
        kind: "gap",
        text: query,
        blanks: [{ marker: "underscore", start: 7, end: 10 }],
        withoutBlanks: "depend   others",
      });
    });

    it("make every ellipsis punctuation in the same query", () => {
      const plan = planGaps("Well... Governments should ___ more money");
      expect(plan).toMatchObject({ kind: "gap", text: "Well  Governments should ___ more money" });
      expect(blanks("Well... Governments should ___ more money")).toEqual(["underscore"]);
    });

    it("need one underscore more than a single one", () => {
      expect(planGaps("should _ more")).toEqual({ kind: "ordinary", text: "should _ more" });
    });
  });

  describe("ellipses", () => {
    it.each(["should … more money", "should ... more money", "The results were ... surprising"])(
      "mark a blank between words: %j",
      (query) => {
        expect(blanks(query)).toEqual(["ellipsis"]);
      },
    );

    it.each([
      ["however...", "however "],
      ["however…", "however "],
      ["There is growing concern about ...", "There is growing concern about  "],
      ["It is worth noting that...", "It is worth noting that "],
      ["...however", " however"],
      ["important..........", "important "],
      ["Prices rose... ?", "Prices rose  ?"],
    ])("are punctuation at an edge: %j", (query, text) => {
      expect(planGaps(query)).toEqual({ kind: "ordinary", text });
    });
  });

  describe("limits", () => {
    it(`reads at most ${MAX_GAPS} blanks; more are an ordinary search, noted`, () => {
      expect(planGaps("a ___ b ___ c ___ d")).toEqual({
        kind: "ordinary",
        text: "a   b   c   d",
        note: "too_many_gaps",
      });
      expect(planGaps("so … it … was … fine")).toMatchObject({
        kind: "ordinary",
        note: "too_many_gaps",
      });
    });

    it("needs words around the blanks", () => {
      for (const query of ["____", "___ ___", "... ___", "?! ___ ..."]) {
        expect(planGaps(query).kind, query).toBe("ordinary");
      }
    });

    it("reads a long run of markers in one pass, without backtracking", () => {
      const dots = `word ${".".repeat(MAX_QUERY_LENGTH)} word`;
      const start = performance.now();
      expect(blanks(dots)).toEqual(["ellipsis"]);
      const underscores = Array.from({ length: 60 }, () => "a __").join(" ");
      expect(planGaps(underscores)).toMatchObject({ kind: "ordinary", note: "too_many_gaps" });
      expect(performance.now() - start).toBeLessThan(250);
    });
  });

  it("is deterministic", () => {
    const query = "Governments should ___ more money ___ public transport...";
    expect(planGaps(query)).toEqual(planGaps(query));
  });
});
