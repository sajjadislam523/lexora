import { describe, expect, it } from "vitest";

import { matchIntent, mistakeWrongPart, showsMistake } from "./match";
import type { IntentDefinition } from "./repository";

const amount = { wrong: "a significant amount of people", right: "a significant number of people" };
const depend = {
  wrong: "Many families depend of one income.",
  right: "Many families depend on one income.",
};

describe("showsMistake", () => {
  it("is true for the whole wrong form", () => {
    expect(showsMistake("a significant amount of people", amount)).toBe(true);
    expect(
      showsMistake("responsible of", { wrong: "responsible of", right: "responsible for" }),
    ).toBe(true);
  });

  it("is true for part of a mistake that covers the wrong words", () => {
    expect(showsMistake("depend of", depend)).toBe(true);
    expect(showsMistake("a significant amount", amount)).toBe(true);
    expect(showsMistake("amount of people", amount)).toBe(true);
  });

  it("is false for correct words that only appear inside a mistake", () => {
    expect(showsMistake("a significant", amount)).toBe(false);
    expect(showsMistake("of people", amount)).toBe(false);
    expect(showsMistake("many families", depend)).toBe(false);
    expect(
      showsMistake("very important", {
        wrong: "My family is very important for me.",
        right: "My family is very important to me.",
      }),
    ).toBe(false);
  });

  it("needs every wrong word when the wrong part is longer than one word", () => {
    const worth = {
      wrong: "It is worth to note that prices fell.",
      right: "It is worth noting that prices fell.",
    };
    expect(showsMistake("worth to note", worth)).toBe(true);
    expect(showsMistake("worth to", worth)).toBe(false);
    // "responsible to" is a pattern in its own right, so it doesn't show "responsible to teach".
    const teach = {
      wrong: "Parents are responsible to teach their children manners.",
      right: "Parents are responsible for teaching their children manners.",
    };
    expect(showsMistake("responsible to", teach)).toBe(false);
    expect(showsMistake("responsible to teach", teach)).toBe(true);
  });

  it("needs the words on both sides of a missing word", () => {
    const missing = {
      wrong: "As result, sales increased.",
      right: "As a result, sales increased.",
    };
    expect(showsMistake("as result", missing)).toBe(true);
    expect(showsMistake("result sales", missing)).toBe(false);
  });

  it("shows a punctuation mistake only for the whole sentence", () => {
    const comma = {
      wrong: "There are many sports such as: tennis, golf and sailing.",
      right: "There are many sports such as tennis, golf and sailing.",
    };
    expect(showsMistake("such as tennis", comma)).toBe(false);
    expect(showsMistake("there are many sports such as tennis golf and sailing", comma)).toBe(true);
  });

  it("matches whole words only", () => {
    expect(showsMistake("amoun of", amount)).toBe(false);
    expect(showsMistake("significant amount", amount)).toBe(true);
  });

  it("needs a neighbouring word when the mistake is extra words", () => {
    // The extra words are only wrong where they stand: alone, they are correct language.
    const redundant = {
      wrong: "Some countries, such as for example Japan, have ageing populations.",
      right: "Some countries, such as Japan, have ageing populations.",
    };
    expect(showsMistake("for example", redundant)).toBe(false);
    expect(showsMistake("as for example", redundant)).toBe(true);
    expect(showsMistake("for example japan", redundant)).toBe(true);
    expect(showsMistake("such as for example", redundant)).toBe(true);
    expect(
      showsMistake("some countries such as for example japan have ageing populations", redundant),
    ).toBe(true);

    const very = { wrong: "play a very crucial role", right: "play a crucial role" };
    expect(showsMistake("a very", very)).toBe(true);
    expect(showsMistake("very crucial", very)).toBe(true);
    expect(showsMistake("play a very crucial role", very)).toBe(true);
  });
});

describe("mistakeWrongPart", () => {
  it("marks extra words, and only extra words", () => {
    expect(
      mistakeWrongPart({ wrong: "such as for example Japan", right: "such as Japan" }),
    ).toEqual({ wrong: ["such", "as", "for", "example", "japan"], span: [2, 3], extra: true });
    // A different word in place of the right one is not extra.
    expect(mistakeWrongPart({ wrong: "responsible of", right: "responsible for" })).toEqual({
      wrong: ["responsible", "of"],
      span: [1, 1],
    });
    // A missing word keeps its own shape.
    expect(mistakeWrongPart({ wrong: "As result", right: "As a result" })).toMatchObject({
      span: [0, 1],
      missing: true,
    });
  });
});

describe("matchIntent", () => {
  const intent = (id: string, triggers: string[], fn?: IntentDefinition["function"]) => ({
    id,
    label: id,
    ...(fn && { function: fn }),
    triggers,
    entries: [],
  });
  const intents: IntentDefinition[] = [
    intent("conclude", ["conclude an essay", "write a conclusion", "sum up"]),
    intent("give-an-opinion", ["give an opinion", "express my view"], "opinion"),
    intent("propose-a-solution", ["propose a solution", "suggest a solution"]),
  ];
  const id = (phrase: string) => matchIntent(phrase, intents)?.intent.id;

  it("matches an exact trigger, and a trigger most of whose words the phrase has", () => {
    expect(id("give an opinion")).toBe("give-an-opinion");
    expect(id("giving an opinion")).toBe("give-an-opinion");
  });

  // Phase 6B: only when nothing else matched.
  it("matches a phrase a trigger covers, with saying verbs as one class", () => {
    expect(id("concluding")).toBe("conclude");
    expect(id("introducing a solution")).toBe("propose-a-solution");
  });

  it("needs a shared word that is more than a saying verb", () => {
    expect(id("giving")).toBeUndefined();
    expect(id("introducing a hobby")).toBeUndefined();
  });
});
