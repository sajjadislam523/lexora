import { describe, expect, it } from "vitest";

import { normaliseQuery } from "../../normalise";
import type { WordClassHit } from "../repository";

import { gapWindows, type GapCandidate } from "./candidates";
import { planGaps } from "./reader";
import { buildLexicon, classConflict, classesOf, readSlot, startsNounPhrase } from "./roles";

const hit = (
  word: string,
  partOfSpeech: WordClassHit["partOfSpeech"],
  formType: WordClassHit["formType"] = "lemma",
  phraseHead = false,
): WordClassHit => ({ word, partOfSpeech, formType, phraseHead });

/** What Lexora's content says of some words (as the repository would return it). */
const lexicon = buildLexicon([
  hit("suffer", "verb_phrase", "lemma", true),
  hit("poverty", "noun"),
  hit("reduce", "verb"),
  hit("rose", "verb", "inflection"),
  hit("rose", "noun", "inflection"),
  hit("rises", "verb", "inflection"),
  hit("rises", "noun", "inflection"),
  hit("increase", "verb"),
  hit("increase", "noun"),
  hit("sharply", "adverb"),
  hit("significant", "adjective"),
  hit("help", "verb"),
]);

const windowOf = (query: string) => {
  const plan = planGaps(query);
  if (plan.kind !== "gap") throw new Error(`not a gap query: ${query}`);
  return gapWindows(normaliseQuery(plan.text), query, plan.blanks)[0]!;
};

const candidate = (overrides: Partial<GapCandidate>): GapCandidate => ({
  gap: 0,
  type: "collocation",
  senseId: "x.y",
  fill: "x",
  term: "x",
  evidence: { id: "x", display: "x" },
  span: 1,
  ...overrides,
});

describe("buildLexicon", () => {
  it("keeps a phrase's head and every sense's class", () => {
    expect([...classesOf("suffer", lexicon)]).toEqual(["verb"]);
    expect([...classesOf("increase", lexicon)].sort()).toEqual(["noun", "verb"]);
  });

  it("reads a non-“-s” inflection as a verb form only", () => {
    expect([...classesOf("rose", lexicon)]).toEqual(["verb"]);
    expect([...classesOf("rises", lexicon)].sort()).toEqual(["noun", "verb"]);
  });

  it("puts closed classes first and knows nothing of other words", () => {
    expect([...classesOf("the", lexicon)]).toEqual(["determiner"]);
    expect([...classesOf("in", lexicon)]).toEqual(["preposition"]);
    expect([...classesOf("2020", lexicon)]).toEqual(["number"]);
    expect([...classesOf("should", lexicon)]).toEqual(["modal"]);
    expect(classesOf("zebra", lexicon).size).toBe(0);
  });
});

describe("startsNounPhrase", () => {
  it.each([
    ["the", true],
    ["2020", true],
    ["poverty", true],
    ["significant", true],
    ["them", true],
    ["they", false],
    ["increase", false],
    ["zebra", false],
  ])("%j → %s", (word, starts) => {
    expect(startsNounPhrase(word, lexicon)).toBe(starts);
  });
});

describe("readSlot", () => {
  const excluded = (query: string) => [...readSlot(windowOf(query), lexicon).keys()].sort();

  it.each([
    // A preposition can't come before another.
    ["Prices rose ___ in 2020", ["preposition", "verb"]],
    // A verb can't follow a verb; an adverb can't split a verb and its object.
    ["suffer ___ poverty", ["adverb", "verb"]],
    ["prices rose ___ 2020", ["adverb", "verb"]],
    // After an article: an adjective or noun.
    ["There was a ___ increase", ["preposition", "verb"]],
    // After a modal: a verb (or adverb).
    ["Governments should ___ more money", ["noun", "preposition"]],
    // A verb that takes another verb, and words Lexora doesn't know, rule nothing out.
    ["help ___ poverty", []],
    ["zebras ___ quickly", []],
    // "increase" can be a noun, so nothing is ruled out after it.
    ["increase ___ the number", []],
  ])("%j excludes %j", (query, classes) => {
    expect(excluded(query)).toEqual(classes);
  });
});

describe("classConflict", () => {
  const conflict = (query: string, c: GapCandidate) => {
    const window = windowOf(query);
    return classConflict(c, window, readSlot(window, lexicon), lexicon);
  };

  it("rules out a verb after a verb, and keeps unknown words", () => {
    expect(conflict("suffer ___ poverty", candidate({ fill: "reduce" }))).toMatchObject({
      kind: "slot",
      wordClass: "verb",
      exclusion: { rule: "after_verb", word: "suffer" },
    });
    expect(conflict("suffer ___ poverty", candidate({ fill: "child" }))).toBeUndefined();
  });

  it("rules out a preposition before a preposition, and keeps an adverb", () => {
    const by = candidate({
      type: "preposition",
      fill: "by",
      evidence: { id: "p", display: "rise by + amount" },
    });
    expect(conflict("Prices rose ___ in 2020", by)).toMatchObject({
      kind: "slot",
      exclusion: { rule: "before_preposition", word: "in" },
    });
    expect(conflict("Prices rose ___ in 2020", candidate({ fill: "sharply" }))).toBeUndefined();
  });

  it("keeps a word with one class the sentence allows", () => {
    // "increase" can be a noun after "a", though not a verb.
    expect(conflict("There was a ___ in prices", candidate({ fill: "increase" }))).toBeUndefined();
  });

  it("rules out a noun pattern on a word only known as a verb", () => {
    const nounPattern = candidate({
      type: "preposition",
      fill: "in",
      evidence: { id: "p", display: "a rise in + noun" },
    });
    expect(conflict("prices rose ___ 2020", nounPattern)).toEqual({
      kind: "noun_pattern",
      word: "rose",
    });
    const verbPattern = { ...nounPattern, evidence: { id: "p", display: "rise by + amount" } };
    expect(conflict("prices rose ___ 2020", verbPattern)).toBeUndefined();
  });

  it("doesn't check linkers", () => {
    expect(
      conflict("Prices rose ___ in 2020", candidate({ type: "linker", fill: "however" })),
    ).toBeUndefined();
  });
});
