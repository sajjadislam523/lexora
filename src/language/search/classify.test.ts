import { describe, expect, it } from "vitest";

import { normaliseQuery } from "../normalise";

import { classify } from "./classify";

const read = (query: string) => classify(normaliseQuery(query));

describe("classify", () => {
  it.each([
    // Synonyms
    ["better word for important", "SYNONYM", "important"],
    ["a better word for important", "SYNONYM", "important"],
    ["another word for significant", "SYNONYM", "significant"],
    ["synonyms for crucial", "SYNONYM", "crucial"],
    ["crucial synonym", "SYNONYM", "crucial"],
    ["instead of important", "SYNONYM", "important"],
    ["what can I use instead of important?", "SYNONYM", "important"],
    ["another way to say important", "SYNONYM", "important"],
    // Stronger and weaker
    ["stronger word for important", "STRONGER_ALTERNATIVE", "important"],
    ["a stronger way to say important", "STRONGER_ALTERNATIVE", "important"],
    ["stronger than significant", "STRONGER_ALTERNATIVE", "significant"],
    ["important but stronger", "STRONGER_ALTERNATIVE", "important"],
    ["weaker word for crucial", "WEAKER_ALTERNATIVE", "crucial"],
    ["softer word for crucial", "WEAKER_ALTERNATIVE", "crucial"],
    ["less strong word for essential", "WEAKER_ALTERNATIVE", "essential"],
    // Alternatives
    ["alternative to however", "ALTERNATIVE", "however"],
    ["alternatives for however", "ALTERNATIVE", "however"],
    ["natural speaking alternative to furthermore", "ALTERNATIVE", "furthermore"],
    ["replace furthermore", "ALTERNATIVE", "furthermore"],
    ["however alternatives", "ALTERNATIVE", "however"],
    // Prepositions
    ["preposition after responsible", "PREPOSITION", "responsible"],
    ["What preposition comes after interested?", "PREPOSITION", "interested"],
    ["which preposition with depend", "PREPOSITION", "depend"],
    ["responsible + ?", "PREPOSITION", "responsible"],
    ["focus preposition", "PREPOSITION", "focus"],
    ["what comes after contribute", "PREPOSITION", "contribute"],
    ["interested in or on?", "PREPOSITION", "interested"],
    // Collocations
    ["collocations with significant", "COLLOCATION", "significant"],
    ["words that go with awareness", "COLLOCATION", "awareness"],
    ["what goes with measures", "COLLOCATION", "measures"],
    ["significant collocations", "COLLOCATION", "significant"],
    ["significant + noun", "COLLOCATION", "significant"],
  ])("%j → %s (%s)", (query, intent, term) => {
    expect(read(query)).toMatchObject({ intent, term });
  });

  it.each([
    ["better linker for contrast", "LINKER", "contrast", "contrast"],
    ["linking words for adding a point", "LINKER", "adding a point", "addition"],
    ["transition to show a result", "LINKER", "a result", "result"],
    ["phrase for giving an example", "PHRASE", "giving an example", "example"],
    ["expressions for causing a serious problem", "PHRASE", "causing a serious problem", "problem"],
    ["a phrase to concede a point", "PHRASE", "concede a point", "concession"],
    ["sentence pattern for a problem", "SENTENCE_PATTERN", "a problem", "problem"],
    ["sentence starters for examples", "SENTENCE_PATTERN", "examples", "example"],
    ["how to start a paragraph about a problem", "SENTENCE_PATTERN", "a problem", "problem"],
    ["I want to express contrast", "CONTEXTUAL_EXPRESSION", "express contrast", "contrast"],
    [
      "I want to say something increased a lot",
      "CONTEXTUAL_EXPRESSION",
      "say something increased a lot",
      undefined,
    ],
    ["How do I add another point?", "CONTEXTUAL_EXPRESSION", "add another point", "addition"],
    ["I'd like to give an example", "CONTEXTUAL_EXPRESSION", "give an example", "example"],
  ])("%j → %s with phrase %j", (query, intent, phrase, fn) => {
    const result = read(query);
    expect(result).toMatchObject({ intent, phrase });
    expect(result.function).toBe(fn);
  });

  it("reads modifiers from the qualifiers", () => {
    expect(read("natural speaking alternative to furthermore").modifiers).toEqual([
      "natural",
      "speaking",
    ]);
    expect(read("formal alternative to on top of that").modifiers).toEqual(["formal"]);
    expect(read("more academic word for important").modifiers).toEqual(["academic"]);
    expect(read("alternative to however").modifiers).toEqual([]);
  });

  it.each([
    "Governments should ____ more money into public transportation",
    "should … more money",
    "We need to ___ the problem",
  ])("recognises a gap: %j", (query) => {
    expect(read(query).intent).toBe("CONTEXT_GAP");
  });

  it.each([
    ["important", "important"],
    ["depend on", "depend on"],
    ["responsible of", "responsible of"],
    ["analyze", "analyze"],
    ["a significant increase", "a significant increase"],
    ["the word important", "the word important"],
  ])("falls back to a lookup for %j", (query, term) => {
    expect(read(query)).toEqual({ intent: "LOOKUP", term, modifiers: [] });
  });
});
