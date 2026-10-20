import { describe, expect, it } from "vitest";

import { showsMistake } from "./match";

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
});
