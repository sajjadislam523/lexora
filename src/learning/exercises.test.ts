import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { evaluateAnswer, normaliseAnswer } from "./answers";
import {
  exerciseFor,
  generateExercises,
  mistakeDifference,
  type Exercise,
  type PracticeMaterial,
} from "./exercises";

/**
 * The exercise generator and answer checking on hand-written material (no database). The real
 * corpus is covered by test/exercise-inventory.test.ts.
 */
type Example = PracticeMaterial["examples"][number];
const example = (
  id: string,
  text: string,
  highlight: string | string[],
  extra: Partial<Example> = {},
): Example => ({
  id,
  text,
  highlights: [highlight]
    .flat()
    .map((h) => {
      const start = text.toLowerCase().indexOf(h.toLowerCase());
      return { start, end: start + h.length };
    })
    .sort((a, b) => a.start - b.start),
  patternId: null,
  accept: [],
  acceptPreposition: [],
  exclude: [],
  ...extra,
});

const significant: PracticeMaterial = {
  senseId: "significant.notable",
  itemKind: "word",
  term: "significant",
  senseLabel: "having a real effect",
  definition: "Large or important enough to have a noticeable effect.",
  forms: ["significant"],
  examples: [
    example(
      "significant.notable:ex1",
      "There was a significant increase in the number of cyclists.",
      "significant increase",
    ),
    example(
      "significant.notable:ex2",
      "Social media has had a significant impact on how young people communicate.",
      "significant impact",
    ),
  ],
  patterns: [],
  mistakes: [
    {
      id: "significant.notable:amount",
      wrong: "a significant amount of people",
      right: "a significant number of people",
      type: "countability",
      explanation: "Use number with countable nouns.",
    },
    {
      id: "significant.notable:significance",
      wrong: "This decision is very significance.",
      right: "This decision is very significant.",
      type: "word_form",
      explanation: "Significant is the adjective.",
    },
  ],
};

const responsible: PracticeMaterial = {
  senseId: "responsible-for.duty",
  itemKind: "preposition_pattern",
  term: "responsible for",
  definition: "Having the job of dealing with something.",
  forms: ["responsible for"],
  examples: [
    example(
      "responsible-for.duty:ex1",
      "Local councils are responsible for maintaining public parks.",
      "responsible for",
      { patternId: "responsible-for.duty:for" },
    ),
    example(
      "responsible-for.duty:ex4",
      "Head teachers are responsible to the school's governors.",
      "responsible to",
      { patternId: "responsible-for.duty:to" },
    ),
  ],
  patterns: [
    {
      id: "responsible-for.duty:for",
      base: "responsible",
      preposition: "for",
      pattern: "be responsible for + noun / -ing",
      note: "the task, thing or result",
      mistakeId: "responsible-for.duty:of",
    },
    {
      id: "responsible-for.duty:to",
      base: "responsible",
      preposition: "to",
      pattern: "be responsible to + person / organisation",
      note: null,
      mistakeId: null,
    },
  ],
  mistakes: [
    {
      id: "responsible-for.duty:of",
      wrong: "responsible of",
      right: "responsible for",
      type: "preposition",
      explanation: "Responsible takes for before the task or result.",
    },
  ],
};

const role: PracticeMaterial = {
  senseId: "play-a-crucial-role.main",
  itemKind: "collocation",
  term: "play a crucial role",
  definition: "To be a very important part of a process.",
  forms: ["play a crucial role", "plays a crucial role", "played a crucial role"],
  examples: [
    example(
      "play-a-crucial-role.main:ex2",
      "Public transport plays a crucial role in reducing congestion.",
      "plays a crucial role in",
      { patternId: "play-a-crucial-role.main:in" },
    ),
  ],
  patterns: [
    {
      id: "play-a-crucial-role.main:in",
      base: "play a crucial role",
      preposition: "in",
      pattern: "play a crucial role in + noun / -ing",
      note: "the process or result",
      mistakeId: null,
    },
  ],
  mistakes: [],
};

const ids = (exercises: Exercise[]) => exercises.map((e) => e.prompt.id);

describe("complete the sentence", () => {
  it("blanks the item's own form inside the highlight", () => {
    const [first] = generateExercises(significant);
    expect(first).toEqual({
      prompt: {
        id: "term:significant.notable:ex1",
        type: "term",
        senseId: "significant.notable",
        term: "significant",
        senseLabel: "having a real effect",
        sentence: ["There was a ", { gap: 0 }, " increase in the number of cyclists."],
        blankWords: 1,
        cue: "Large or important enough to have a noticeable effect.",
      },
      key: {
        kind: "typed",
        expected: "significant",
        forms: [],
        accepted: [],
        mistakes: [{ answer: "significance", mistakeId: "significant.notable:significance" }],
      },
      source: "significant.notable:ex1",
    });
  });

  it("blanks the inflection the sentence uses, and accepts the item's other forms", () => {
    const [term] = generateExercises(role);
    expect(term?.prompt.sentence).toEqual([
      "Public transport ",
      { gap: 0 },
      " in reducing congestion.",
    ]);
    expect(term?.prompt.blankWords).toBe(4);
    expect(term?.key).toMatchObject({
      expected: "plays a crucial role",
      forms: ["play a crucial role", "played a crucial role"],
    });
  });

  it("keeps a linker's punctuation in the sentence, outside the blank", () => {
    const however: PracticeMaterial = {
      ...significant,
      senseId: "however.contrast",
      itemKind: "linker",
      forms: ["however"],
      mistakes: [],
      examples: [
        example(
          "however.contrast:ex1",
          "Public transport is cheap. However, it is slow.",
          "However,",
        ),
      ],
    };
    expect(generateExercises(however)[0]?.prompt.sentence).toEqual([
      "Public transport is cheap. ",
      { gap: 0 },
      ", it is slow.",
    ]);
  });

  it("uses an authored accept list, and nothing else", () => {
    const withAccept: PracticeMaterial = {
      ...significant,
      examples: [{ ...significant.examples[0]!, accept: ["considerable", "Substantial"] }],
    };
    const [term] = generateExercises(withAccept);
    expect(term?.key).toMatchObject({ accepted: ["considerable", "substantial"] });
    // Without it, a near-synonym is not accepted: nothing is derived from relations.
    const [plain] = generateExercises(significant);
    expect(evaluateAnswer(plain!.key, "considerable")).toMatchObject({
      outcome: "incorrect",
      match: "unrecognised",
    });
  });

  it.each([
    [
      "the form is split by another word",
      "Governments must take urgent measures.",
      "take urgent measures",
      ["take measures"],
    ],
    [
      "the form isn't inside a highlight",
      "There was a significant rise, and a significant fall.",
      "rise",
      ["significant"],
    ],
    [
      "the form occurs twice",
      "A significant rise and a significant fall.",
      "significant rise",
      ["significant"],
    ],
    ["the blank would be the whole sentence", "Significant.", "Significant", ["significant"]],
  ])("is skipped when %s", (_, text, highlight, forms) => {
    const material: PracticeMaterial = {
      ...significant,
      forms,
      mistakes: [],
      examples: [example("x.y:ex1", text, highlight)],
    };
    expect(generateExercises(material)).toEqual([]);
  });

  it("is skipped for preposition-pattern items and for exclude: [term]", () => {
    expect(generateExercises(responsible).map((e) => e.prompt.type)).not.toContain("term");
    const excluded: PracticeMaterial = {
      ...significant,
      mistakes: [],
      examples: [{ ...significant.examples[0]!, exclude: ["term"] }],
    };
    expect(generateExercises(excluded)).toEqual([]);
  });
});

describe("type the preposition", () => {
  it("blanks the pattern's preposition at the end of the highlight", () => {
    const [first] = generateExercises(responsible);
    expect(first).toEqual({
      prompt: {
        id: "preposition:responsible-for.duty:ex1",
        type: "preposition",
        senseId: "responsible-for.duty",
        term: "responsible for",
        sentence: ["Local councils are responsible ", { gap: 0 }, " maintaining public parks."],
        cue: "be responsible ___ + noun / -ing",
      },
      key: {
        kind: "typed",
        expected: "for",
        forms: [],
        accepted: [],
        mistakes: [{ answer: "of", mistakeId: "responsible-for.duty:of" }],
      },
      source: "responsible-for.duty:ex1",
      explanation: "the task, thing or result",
    });
  });

  it("answers by the example's own pattern", () => {
    const toExercise = generateExercises(responsible).find(
      (e) => e.prompt.id === "preposition:responsible-for.duty:ex4",
    );
    expect(toExercise?.key).toMatchObject({ expected: "to", mistakes: [] });
    expect(toExercise?.prompt.cue).toBe("be responsible ___ + person / organisation");
  });

  it("accepts authored alternatives only", () => {
    const material: PracticeMaterial = {
      ...role,
      examples: [{ ...role.examples[0]!, acceptPreposition: ["within"] }],
    };
    const preposition = generateExercises(material).find((e) => e.prompt.type === "preposition");
    expect(preposition?.key).toMatchObject({ expected: "in", accepted: ["within"] });
  });

  it.each([
    [
      "the highlight doesn't end with it",
      "responsible for maintaining",
      "responsible-for.duty:for",
    ],
    ["the pattern is missing", "responsible for", "responsible-for.duty:nope"],
  ])("is skipped when %s", (_, highlight, patternId) => {
    const material: PracticeMaterial = {
      ...responsible,
      examples: [
        example(
          "responsible-for.duty:ex9",
          "Local councils are responsible for maintaining public parks.",
          highlight,
          { patternId },
        ),
      ],
    };
    expect(generateExercises(material).filter((e) => e.prompt.type === "preposition")).toEqual([]);
  });

  it("is skipped when the preposition occurs twice in the highlight, or for exclude", () => {
    const twice: PracticeMaterial = {
      ...role,
      examples: [
        example("r.m:ex1", "It plays a role in tourism in cities.", "a role in tourism in", {
          patternId: "play-a-crucial-role.main:in",
        }),
      ],
    };
    expect(generateExercises(twice).filter((e) => e.prompt.type === "preposition")).toEqual([]);
    const excluded: PracticeMaterial = {
      ...responsible,
      examples: responsible.examples.map((e) => ({ ...e, exclude: ["preposition" as const] })),
    };
    expect(generateExercises(excluded).filter((e) => e.prompt.type === "preposition")).toEqual([]);
  });
});

describe("which is correct?", () => {
  it("offers the authored right and wrong versions under opaque IDs", () => {
    const choice = generateExercises(responsible).find((e) => e.prompt.type === "mistake");
    expect(choice).toEqual({
      prompt: {
        id: "mistake:responsible-for.duty:of",
        type: "mistake",
        senseId: "responsible-for.duty",
        term: "responsible for",
        cue: "Which is correct?",
        options: [
          { id: "a", text: "responsible for" },
          { id: "b", text: "responsible of" },
        ],
      },
      key: {
        kind: "choice",
        expected: "responsible for",
        correctOption: "a",
        wrongOption: "b",
        mistakeId: "responsible-for.duty:of",
      },
      source: "responsible-for.duty:of",
      explanation: "Responsible takes for before the task or result.",
    });
  });

  it("swaps the order with the card's review count, deterministically", () => {
    const options = (reviews: number) =>
      generateExercises(responsible, reviews)
        .find((e) => e.prompt.type === "mistake")!
        .prompt.options!.map((o) => o.text);
    expect(options(0)).toEqual(["responsible for", "responsible of"]);
    expect(options(1)).toEqual(["responsible of", "responsible for"]);
    expect(options(2)).toEqual(options(0));
  });

  it("keeps punctuation-only mistakes, which read differently as written", () => {
    const material: PracticeMaterial = {
      ...significant,
      examples: [],
      mistakes: [
        {
          id: "however.contrast:no-comma",
          wrong: "However the plan has some problems.",
          right: "However, the plan has some problems.",
          type: "punctuation",
          explanation: "Put a comma after however.",
        },
      ],
    };
    expect(ids(generateExercises(material))).toEqual(["mistake:however.contrast:no-comma"]);
  });

  it("is skipped when both versions read the same", () => {
    const material: PracticeMaterial = {
      ...significant,
      examples: [],
      mistakes: [
        { id: "x.y:same", wrong: "same", right: " same ", type: "grammar", explanation: "" },
      ],
    };
    expect(generateExercises(material)).toEqual([]);
  });
});

describe("order and selection", () => {
  it("takes the types in turn, each list in authored order", () => {
    expect(ids(generateExercises(significant))).toEqual([
      "term:significant.notable:ex1",
      "mistake:significant.notable:amount",
      "term:significant.notable:ex2",
      "mistake:significant.notable:significance",
    ]);
    expect(ids(generateExercises(responsible))).toEqual([
      "preposition:responsible-for.duty:ex1",
      "mistake:responsible-for.duty:of",
      "preposition:responsible-for.duty:ex4",
    ]);
  });

  it("moves to the next exercise with each review, and starts again at the end", () => {
    const picked = [0, 1, 2, 3, 4].map((reviews) => exerciseFor(significant, reviews)?.prompt.id);
    expect(picked).toEqual([
      "term:significant.notable:ex1",
      "mistake:significant.notable:amount",
      "term:significant.notable:ex2",
      "mistake:significant.notable:significance",
      "term:significant.notable:ex1",
    ]);
  });

  it("returns nothing, without failing, when the content supports no exercise", () => {
    const bare: PracticeMaterial = { ...significant, examples: [], mistakes: [] };
    expect(generateExercises(bare)).toEqual([]);
    expect(exerciseFor(bare, 3)).toBeNull();
  });

  it("gives byte-identical output for the same input, and never changes the input", () => {
    const input = structuredClone(responsible);
    const frozen = deepFreeze(structuredClone(responsible));
    expect(JSON.stringify(generateExercises(frozen, 5))).toBe(
      JSON.stringify(generateExercises(input, 5)),
    );
    expect(input).toEqual(responsible);
  });

  it("imports nothing but a vocabulary type and its own answer checking: no database, network, clock or randomness", () => {
    const source = readFileSync("src/learning/exercises.ts", "utf8");
    expect([...source.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1])).toEqual([
      "@/language/schema/vocabulary",
      "./answers",
    ]);
    expect(source).toMatch(
      /^import type \{ PracticeBlank \} from "@\/language\/schema\/vocabulary";$/m,
    );
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date|fetch\(/);
  });
});

describe("answers", () => {
  const [term, mistake] = generateExercises(significant);

  it("normalises only case, apostrophes, spacing and end punctuation", () => {
    expect(normaliseAnswer("  Significant, ")).toBe("significant");
    expect(normaliseAnswer("What’s   MORE")).toBe("what's more");
    expect(normaliseAnswer("well-known")).toBe("well-known");
    expect(normaliseAnswer("signifcant")).toBe("signifcant");
  });

  it("reads the expected answer, other forms, accepted answers, mistakes and the rest", () => {
    expect(evaluateAnswer(term!.key, " SIGNIFICANT ")).toEqual({
      valid: true,
      outcome: "correct",
      match: "expected",
      mistakeId: null,
      answer: "significant",
    });
    const [roleTerm] = generateExercises(role);
    expect(evaluateAnswer(roleTerm!.key, "play a crucial role")).toMatchObject({
      outcome: "correct",
      match: "form",
    });
    expect(evaluateAnswer(term!.key, "significance")).toMatchObject({
      outcome: "incorrect",
      match: "mistake",
      mistakeId: "significant.notable:significance",
    });
    // No spelling correction, stemming or similarity.
    for (const near of ["signifcant", "significants", "significantly", "important"]) {
      expect(evaluateAnswer(term!.key, near)).toMatchObject({
        outcome: "incorrect",
        match: "unrecognised",
      });
    }
  });

  it("checks a typed preposition, recognising the authored wrong one", () => {
    const [preposition] = generateExercises(responsible);
    expect(evaluateAnswer(preposition!.key, "For")).toMatchObject({ outcome: "correct" });
    expect(evaluateAnswer(preposition!.key, "of")).toMatchObject({
      outcome: "incorrect",
      match: "mistake",
      mistakeId: "responsible-for.duty:of",
    });
    expect(evaluateAnswer(preposition!.key, "at")).toMatchObject({ match: "unrecognised" });
  });

  it("checks a choice by option ID", () => {
    expect(
      evaluateAnswer(
        mistake!.key,
        mistake!.key.kind === "choice" ? mistake!.key.correctOption : "",
      ),
    ).toMatchObject({
      outcome: "correct",
      match: "expected",
    });
    const wrong = mistake!.key.kind === "choice" ? mistake!.key.wrongOption : "";
    expect(evaluateAnswer(mistake!.key, wrong)).toMatchObject({
      outcome: "incorrect",
      match: "mistake",
      mistakeId: "significant.notable:amount",
    });
    expect(evaluateAnswer(mistake!.key, "c")).toEqual({ valid: false });
  });

  it("isn't an answer when empty", () => {
    expect(evaluateAnswer(term!.key, "  ,  ")).toEqual({ valid: false });
  });

  it("finds the words a mistake changes", () => {
    expect(mistakeDifference({ wrong: "responsible of", right: "responsible for" })).toEqual({
      wrong: "of",
      right: "for",
    });
    expect(
      mistakeDifference({
        wrong: "Parents are responsible to teach their children manners.",
        right: "Parents are responsible for teaching their children manners.",
      }),
    ).toEqual({ wrong: "to teach", right: "for teaching" });
  });
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
