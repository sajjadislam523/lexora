import { describe, expect, it } from "vitest";

import {
  adverbOf,
  describesNear,
  glossRank,
  phraseShape,
  QUALITIES,
  QUALITY_SIGNALS,
  readDescriptor,
  signalRank,
  signalsOf,
} from "./descriptors";

describe("readDescriptor", () => {
  it.each([
    ["a large increase", "large", ["large"], "increase", "noun"],
    ["large increase", "large", ["large"], "increase", "noun"],
    ["a huge rise", "huge", ["large"], "rise", "noun"],
    ["a small increase", "small", ["small"], "increase", "noun"],
    ["a slight decrease", "slight", ["small"], "decrease", "noun"],
    ["a rapid increase", "rapid", ["rapid"], "increase", "noun"],
    ["a sharp fall", "sharp", ["rapid", "large"], "fall", "noun"],
    ["a gradual decline", "gradual", ["gradual"], "decline", "noun"],
    ["a very large increase", "large", ["large"], "increase", "noun"],
    ["rise sharply", "sharply", ["rapid", "large"], "rise", "verb"],
    ["increase gradually", "gradually", ["gradual"], "increase", "verb"],
  ])("%j → %s (%j) on %j", (term, word, qualities, head, reading) => {
    expect(readDescriptor(term)).toEqual({ kind: "quality", word, qualities, head, reading });
  });

  it.each([
    ["very important", "stronger", "important"],
    ["extremely good", "stronger", "good"],
    ["slightly important", "weaker", "important"],
  ])("%j → a %s word for %j", (term, direction, head) => {
    expect(readDescriptor(term)).toMatchObject({ kind: "intensity", direction, head });
  });

  it.each(["large", "a large", "important", "increase", "public transport", "the increase"])(
    "reads nothing in %j",
    (term) => {
      expect(readDescriptor(term)).toBeUndefined();
    },
  );
});

describe("signals", () => {
  it("gives every quality signals and glosses", () => {
    for (const quality of QUALITIES) {
      expect(QUALITY_SIGNALS[quality].signals.length, quality).toBeGreaterThan(0);
      expect(QUALITY_SIGNALS[quality].glosses.length, quality).toBeGreaterThan(0);
    }
  });

  it("merges qualities, the first quality's first", () => {
    expect(signalsOf(["rapid", "large"]).signals.slice(0, 2)).toEqual(["sharp", "rapid"]);
    expect(signalsOf(["rapid", "large"]).signals).toContain("significant");
  });

  it.each([
    ["dramatic", "dramatically"],
    ["steady", "steadily"],
    ["gradual", "gradually"],
    ["considerable", "considerably"],
    ["sharp", "sharply"],
  ])("makes the adverb of %j", (adjective, adverb) => {
    expect(adverbOf(adjective)).toBe(adverb);
  });

  it("ranks a phrase by its first signal, as the word or its adverb", () => {
    const { signals } = QUALITY_SIGNALS.large;
    expect(signalRank("a significant increase", signals)).toBe(0);
    expect(signalRank("a substantial increase", signals)).toBe(1);
    expect(signalRank("rise dramatically", signals)).toBe(3);
    expect(signalRank("a sharp increase", signals)).toBe(-1);
  });
});

describe("glossRank", () => {
  const { glosses } = QUALITY_SIGNALS.large;

  it("finds a gloss as whole words", () => {
    expect(glossRank("to rise suddenly by a large amount", glosses)).toBe(0);
    expect(glossRank("to become larger in number", glosses)).toBe(-1);
  });

  it("ignores a negated gloss", () => {
    expect(glossRank("not very large serious or important", glosses)).toBe(-1);
    expect(glossRank("not large but large enough", glosses)).toBe(0);
  });
});

describe("describesNear", () => {
  const { glosses, signals } = QUALITY_SIGNALS.small;

  it("needs the descriptor next to the head word, not elsewhere in the note", () => {
    expect(
      describesNear("rise is equally common and slightly less formal", ["rise"], glosses, signals),
    ).toBe(-1);
    expect(
      describesNear("a slight rise in prices", ["rise"], glosses, signals),
    ).toBeGreaterThanOrEqual(0);
    expect(
      describesNear(
        "surge means a sudden large increase",
        ["increase"],
        QUALITY_SIGNALS.large.glosses,
        QUALITY_SIGNALS.large.signals,
      ),
    ).toBe(0);
  });
});

describe("phraseShape", () => {
  const { signals } = QUALITY_SIGNALS.large;

  it("tells a noun phrase from a verb phrase", () => {
    expect(phraseShape("a significant increase", ["increase"], signals)).toBe("noun");
    expect(phraseShape("increase significantly", ["increase"], signals)).toBe("verb");
    expect(phraseShape("a sharp increase", ["increase"], signals)).toBeUndefined();
  });
});
