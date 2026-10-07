import { describe, expect, it } from "vitest";

import { chooseCorrection, contentStems, editDistance, stem, trigramSimilarity } from "./text";

describe("editDistance", () => {
  it.each([
    ["responsable", "responsible", 1],
    ["signifcant", "significant", 1],
    ["furthermoe", "furthermore", 1],
    ["teh", "the", 1],
    ["crucial", "crucial", 0],
    ["kitten", "sitting", 3],
  ])("%s → %s = %i", (a, b, distance) => {
    expect(editDistance(a, b)).toBe(distance);
  });
});

describe("chooseCorrection", () => {
  it.each([
    ["responsable for", ["responsible for", "responsible"], "responsible for"],
    ["signifcant", ["significant", "sufficient"], "significant"],
    ["furthermoe", ["furthermore"], "furthermore"],
  ])("corrects %s", (term, candidates, expected) => {
    expect(chooseCorrection(term, candidates)).toMatchObject({ kind: "corrected", to: expected });
  });

  it("allows one edit for terms of 4–7 characters", () => {
    expect(chooseCorrection("cruical", ["crucial"]).kind).toBe("corrected");
    expect(chooseCorrection("crusal", ["crucial"]).kind).toBe("none");
  });

  it("allows two edits for terms of 8 characters or more", () => {
    expect(chooseCorrection("signfcant", ["significant"]).kind).toBe("corrected");
    expect(chooseCorrection("sgnfcant", ["significant"]).kind).toBe("none");
  });

  it("never corrects short words or stopwords", () => {
    expect(chooseCorrection("rse", ["rise"]).kind).toBe("none");
    expect(chooseCorrection("with", ["width"]).kind).toBe("none");
  });

  it("reports a tie instead of guessing", () => {
    expect(chooseCorrection("rice", ["rise", "ride"])).toEqual({
      kind: "ambiguous",
      options: ["ride", "rise"],
    });
  });

  it("doesn't correct an exact match", () => {
    expect(chooseCorrection("however", ["however"]).kind).toBe("none");
  });
});

describe("stems", () => {
  it("lets inflected trigger words match", () => {
    expect(stem("giving")).toBe(stem("give"));
    expect(stem("increased")).toBe(stem("increase"));
    expect(stem("examples")).toBe(stem("example"));
    expect(stem("causing")).toBe(stem("cause"));
  });

  it("drops stopwords", () => {
    expect(contentStems("phrase for giving an example")).toEqual(["phras", "giv", "exampl"]);
  });
});

describe("trigramSimilarity", () => {
  it("rates near spellings highly and unrelated words low", () => {
    expect(trigramSimilarity("responsable for", "responsible for")).toBeGreaterThan(0.4);
    expect(trigramSimilarity("crucial", "whereas")).toBeLessThan(0.1);
  });
});
