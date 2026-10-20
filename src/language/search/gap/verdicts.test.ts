import { describe, expect, it } from "vitest";

import { normaliseQuery } from "../../normalise";
import type { MistakeHit } from "../repository";

import { gapWindows, type GapCandidate } from "./candidates";
import { planGaps } from "./reader";
import {
  collocationVerdict,
  framePrepositionVerdict,
  frameVerdict,
  jointVerdict,
  linkerVerdict,
  prepositionVerdict,
  recreatedMistake,
  VERDICT_ORDER,
} from "./verdicts";

function window(query: string) {
  const plan = planGaps(query);
  if (plan.kind !== "gap") throw new Error(`not a gap query: ${query}`);
  return gapWindows(normaliseQuery(plan.text), query, plan.blanks)[0]!;
}

const preposition = (over: Partial<GapCandidate> = {}): GapCandidate => ({
  gap: 0,
  type: "preposition",
  senseId: "responsible-for.duty",
  fill: "for",
  term: "responsible for",
  evidence: { id: "responsible-for.duty:for", display: "be responsible for + noun / -ing" },
  span: 1,
  complement: "noun_or_ing",
  ...over,
});

const familyMistake: MistakeHit = {
  id: "important.main:for-me",
  senseId: "important.main",
  wrong: "My family is very important for me.",
  right: "My family is very important to me.",
  explanation: "Use “important to” for a person.",
  type: "preposition",
};

const verdictOf = (query: string, over: Partial<GapCandidate> = {}, mistakes: MistakeHit[] = []) =>
  prepositionVerdict(preposition(over), window(query), mistakes);

describe("preposition verdicts", () => {
  it("fits when what follows is what the pattern says follows", () => {
    expect(verdictOf("responsible ___ the project")).toMatchObject({
      verdict: "fits",
      signals: ["pattern", "noun_phrase_follows"],
    });
    expect(verdictOf("responsible ___ maintaining parks").signals).toContain("ing_follows");
    expect(verdictOf("responsible ___ them", { complement: "person", fill: "to" }).verdict).toBe(
      "fits",
    );
    expect(verdictOf("It depends ___ whether it rains", { complement: "clause" }).verdict).toBe(
      "fits",
    );
  });

  it("likely fits when a noun follows that Lexora can't check", () => {
    expect(verdictOf("Cars are responsible ___ pollution")).toMatchObject({
      verdict: "likely_fits",
      signals: ["pattern", "noun_unchecked"],
    });
  });

  it("depends when what decides the fit isn't in the sentence", () => {
    expect(verdictOf("responsible ___")).toMatchObject({
      verdict: "depends",
      signals: ["pattern", "nothing_follows"],
    });
    expect(verdictOf("responsible ___ the council", { complement: "person" }).verdict).toBe(
      "depends",
    );
    expect(verdictOf("depend ___ others", { complement: "clause" }).verdict).toBe("depends");
  });

  it("is unlikely when the filled-in words recreate an authored mistake — before anything else", () => {
    const verdict = verdictOf(
      "My family is very important ___ me",
      { senseId: "important.main", complement: "noun_or_ing" },
      [familyMistake],
    );
    expect(verdict).toMatchObject({ verdict: "unlikely", signals: ["authored_mistake"] });
    expect(verdict.mistake?.id).toBe("important.main:for-me");
  });

  it("needs words on both sides to recreate a mistake, so a correct use isn't caught", () => {
    expect(recreatedMistake(window("important ___ young people"), "for", [familyMistake])).toBe(
      undefined,
    );
    expect(recreatedMistake(window("important ___ me"), "for", [familyMistake])?.id).toBe(
      familyMistake.id,
    );
    expect(recreatedMistake(window("important ___ me"), "to", [familyMistake])).toBe(undefined);
  });

  it("only uses the mistakes it is given (its own sense's)", () => {
    expect(verdictOf("My family is very important ___ me", {}, []).verdict).not.toBe("unlikely");
  });
});

describe("collocation verdicts", () => {
  const collocation = (over: Partial<GapCandidate> = {}): GapCandidate => ({
    gap: 0,
    type: "collocation",
    senseId: "significant.notable",
    fill: "significant",
    term: "a significant increase",
    evidence: { id: "significant.notable:increase", display: "a significant increase" },
    span: 2,
    ...over,
  });

  it("fits when the collocation's words are the learner's, as written", () => {
    expect(collocationVerdict(collocation(), window("There was a ___ increase"), [])).toMatchObject(
      {
        verdict: "fits",
        signals: ["collocation"],
      },
    );
  });

  it("likely fits when a word matched only through an inflection", () => {
    expect(
      collocationVerdict(collocation({ inflected: true }), window("There was a ___ increase"), [])
        .verdict,
    ).toBe("likely_fits");
  });

  it("is unlikely when it recreates the sense's authored mistake", () => {
    const mistake: MistakeHit = {
      id: "raise-awareness.inform:make",
      senseId: "raise-awareness.inform",
      wrong: "make awareness about pollution",
      right: "raise awareness about pollution",
      explanation: "We raise awareness.",
      type: "collocation",
    };
    const verdict = collocationVerdict(
      collocation({ senseId: "raise-awareness.inform", fill: "make", term: "x" }),
      window("Schools should ___ awareness about pollution"),
      [mistake],
    );
    expect(verdict.verdict).toBe("unlikely");
  });
});

describe("Step 4.4: collocation verdicts", () => {
  const steps = (over: Partial<GapCandidate> = {}): GapCandidate => ({
    gap: 0,
    type: "collocation",
    senseId: "take-measures.act",
    fill: "steps",
    term: "take steps",
    evidence: { id: "take-measures.act:steps", display: "take steps" },
    span: 1,
    ...over,
  });

  it("is at most likely fits when a content word after the blank is unchecked (G3)", () => {
    expect(
      collocationVerdict(steps({ openRight: true }), window("They take ___ measures"), []),
    ).toMatchObject({
      verdict: "likely_fits",
      signals: ["collocation", "other_side_unchecked"],
      reason: "Matches the collocation “take steps”; Lexora can't check “measures” after it.",
    });
    expect(
      collocationVerdict(
        steps({ openRight: true, inflected: true }),
        window("They took ___ measures"),
        [],
      ).signals,
    ).toEqual(["collocation", "inflected", "other_side_unchecked"]);
  });

  it("is at most likely fits when a function word before it is unchecked", () => {
    const pose = steps({
      fill: "pose",
      term: "pose a threat",
      evidence: { id: "form:pose-a-threat:pose a threat", display: "pose a threat" },
      openLeft: true,
    });
    expect(collocationVerdict(pose, window("There is ___ a threat"), [])).toEqual({
      verdict: "likely_fits",
      signals: ["collocation", "other_side_unchecked"],
      reason: "Matches the collocation “pose a threat”; Lexora can't check “is” before it.",
    });
    expect(
      collocationVerdict({ ...pose, authoredForm: true }, window("There is ___ a threat"), [])
        .signals,
    ).toEqual(["collocation", "authored_form", "other_side_unchecked"]);
    expect(
      collocationVerdict({ ...pose, openLeft: undefined }, window("Waste ___ a threat"), [])
        .verdict,
    ).toBe("fits");
  });

  it("fits through an authored inflection, and says so", () => {
    expect(
      collocationVerdict(steps({ authoredForm: true }), window("They took ___ to cut costs"), []),
    ).toMatchObject({ verdict: "fits", signals: ["collocation", "authored_form"] });
  });

  it("still puts a recreated mistake first", () => {
    const mistake: MistakeHit = {
      id: "take-measures.act:make",
      senseId: "take-measures.act",
      wrong: "make measures to reduce crime",
      right: "take measures to reduce crime",
      explanation: "We take measures.",
      type: "collocation",
    };
    expect(
      collocationVerdict(
        steps({ fill: "make", openRight: true }),
        window("should ___ measures to reduce crime"),
        [mistake],
      ).verdict,
    ).toBe("unlikely");
  });
});

describe("Step 4.4: prepositions after a verb frame's object", () => {
  const frame = (over: Partial<GapCandidate> = {}): GapCandidate => ({
    gap: 0,
    type: "frame_preposition",
    senseId: "allocate.distribute",
    fill: "to",
    term: "allocate … to",
    complement: "noun",
    evidence: { id: "allocate.distribute:money-to", display: "allocate something to / for + noun" },
    span: 2,
    context: "allocated money",
    objectAuthored: true,
    ...over,
  });

  it("judges what follows against the complement, with the frame object as evidence", () => {
    expect(
      framePrepositionVerdict(frame(), window("They allocated money ___ the schools"), []),
    ).toMatchObject({ verdict: "fits", signals: ["frame_object", "noun_phrase_follows"] });
    expect(
      framePrepositionVerdict(frame(), window("They allocated money ___ education"), []),
    ).toMatchObject({
      verdict: "likely_fits",
      signals: ["frame_object", "noun_unchecked"],
      reason:
        "Matches the frame “allocate something to / for + noun” with “money” as its object; Lexora can't check that “education” starts a noun phrase.",
    });
    expect(framePrepositionVerdict(frame(), window("They allocated money ___"), []).verdict).toBe(
      "depends",
    );
    expect(
      framePrepositionVerdict(
        frame({ complement: "noun_or_ing" }),
        window("She devoted her life ___ helping others"),
        [],
      ).signals,
    ).toEqual(["frame_object", "ing_follows"]);
  });

  it("is not supported when the frame doesn't author the object, whatever follows", () => {
    expect(
      framePrepositionVerdict(
        frame({ objectAuthored: false }),
        window("They allocated land ___ the schools"),
        [],
      ),
    ).toMatchObject({ verdict: "not_supported", signals: ["frame_object_not_authored"] });
  });

  it("is unlikely before anything else when it recreates an authored mistake", () => {
    const mistake: MistakeHit = {
      id: "allocate.distribute:in",
      senseId: "allocate.distribute",
      wrong: "The council allocated money in education.",
      right: "The council allocated money to education.",
      explanation: "Allocate money to something.",
      type: "preposition",
    };
    expect(
      framePrepositionVerdict(
        frame({ fill: "in", objectAuthored: false }),
        window("The council allocated money ___ education"),
        [mistake],
      ).verdict,
    ).toBe("unlikely");
    expect(
      framePrepositionVerdict(frame(), window("The council allocated money ___ education"), [
        mistake,
      ]).verdict,
    ).toBe("likely_fits");
  });
});

describe("linker verdicts", () => {
  it("depend: the position matches, but which relationship fits isn't read", () => {
    expect(linkerVerdict("start", "contrast")).toMatchObject({
      verdict: "depends",
      signals: ["linker_position", "position:start"],
    });
    expect(linkerVerdict("after_comma", undefined).reason).toMatch(
      /^A linker that goes after a comma/,
    );
  });
});

describe("verb-frame verdicts (from the protected Phase 3 fit)", () => {
  it.each([
    ["fits", true, "fits"],
    ["fits", false, "likely_fits"],
    ["different_preposition", true, "unlikely"],
    ["unlikely", true, "not_supported"],
  ] as const)("%s (preposition read: %s) → %s", (fit, read, verdict) => {
    expect(frameVerdict(fit, read).verdict).toBe(verdict);
  });
});

describe("verdict order", () => {
  it("lists fits, likely fits, depends, unlikely, not supported", () => {
    expect(
      Object.entries(VERDICT_ORDER)
        .sort((a, b) => a[1] - b[1])
        .map(([v]) => v),
    ).toEqual(["fits", "likely_fits", "depends", "unlikely", "not_supported"]);
  });
});

describe("Step 4.5: collocations made of function words", () => {
  const crucial: GapCandidate = {
    gap: 0,
    type: "collocation",
    senseId: "crucial.essential",
    fill: "crucial",
    term: "it is crucial that",
    evidence: { id: "crucial.essential:that", display: "it is crucial that" },
    span: 3,
    functionWordsOnly: true,
  };

  it("are never better than likely fits, whatever follows", () => {
    for (const query of ["It is ___ that the government acts", "It is ___ that I like most"]) {
      expect(collocationVerdict(crucial, window(query), []), query).toMatchObject({
        verdict: "likely_fits",
        signals: ["collocation", "function_words_only"],
      });
    }
  });

  it("names the unchecked word after a collocation that ends after the blank (R-2)", () => {
    const key: GapCandidate = {
      gap: 0,
      type: "collocation",
      senseId: "play-a-crucial-role.main",
      fill: "key",
      term: "play a key role",
      evidence: { id: "play-a-crucial-role.main:key", display: "play a key role" },
      span: 3,
      openRight: true,
      rightWord: "models",
    };
    expect(collocationVerdict(key, window("Teachers play a ___ role models"), [])).toEqual({
      verdict: "likely_fits",
      signals: ["collocation", "other_side_unchecked"],
      reason: "Matches the collocation “play a key role”; Lexora can't check “models” after it.",
    });
  });
});

describe("Step 4.5: one structure for both blanks", () => {
  const windowsOf = (query: string) => {
    const plan = planGaps(query);
    if (plan.kind !== "gap") throw new Error(`not a gap query: ${query}`);
    return gapWindows(normaliseQuery(plan.text), query, plan.blanks);
  };
  const pair = (over: Partial<GapCandidate> = {}): GapCandidate => ({
    gap: 0,
    type: "joint",
    structure: "frame",
    senseId: "invest.money",
    fill: "invest",
    preposition: "in",
    term: "invest … in",
    complement: "noun_or_ing",
    evidence: { id: "invest.money:money-in", display: "invest something in / into + noun" },
    span: 4,
    ...over,
  });
  const judge = (
    query: string,
    between: string[],
    over: Partial<GapCandidate> = {},
    m: MistakeHit[] = [],
  ) => {
    const [first, second] = windowsOf(query);
    return jointVerdict(pair(over), first!, second!, between, m);
  };

  it("judges what follows the second blank, with one shared verdict", () => {
    expect(judge("They should ___ more money ___ the project", ["more", "money"])).toMatchObject({
      verdict: "fits",
      signals: ["joint", "frame_object", "noun_phrase_follows"],
    });
    expect(judge("They should ___ more money ___ schools", ["more", "money"]).verdict).toBe(
      "likely_fits",
    );
    expect(
      judge("They should ___ more money ___ improving schools", ["more", "money"]).verdict,
    ).toBe("fits");
    expect(judge("They should ___ more money ___", ["more", "money"]).verdict).toBe("depends");
  });

  it("is at most likely fits when the word before the first blank is unchecked", () => {
    expect(
      judge("We need to ___ more money ___ the project", ["more", "money"], { openLeft: true }),
    ).toMatchObject({
      verdict: "likely_fits",
      signals: ["joint", "frame_object", "noun_phrase_follows", "other_side_unchecked"],
    });
  });

  it("is unlikely when the sentence with both blanks filled recreates an authored mistake", () => {
    const mistake: MistakeHit = {
      id: "allocate.distribute:in",
      senseId: "allocate.distribute",
      wrong: "The council allocated money in education.",
      right: "The council allocated money to education.",
      explanation: "Allocate money to something.",
      type: "preposition",
    };
    const allocateIn = { senseId: "allocate.distribute", fill: "allocated", preposition: "in" };
    expect(
      judge("The council ___ money ___ education", ["money"], allocateIn, [mistake]).verdict,
    ).toBe("unlikely");
    expect(
      judge(
        "The council ___ money ___ education",
        ["money"],
        { ...allocateIn, preposition: "to" },
        [mistake],
      ).verdict,
    ).toBe("likely_fits");
  });

  it("reads a pattern on a phrase with the pattern as evidence", () => {
    expect(
      judge("Plastic waste ___ a threat ___ marine life", ["a", "threat"], {
        structure: "pattern",
        senseId: "pose-a-threat.danger",
        fill: "pose",
        preposition: "to",
        complement: "noun",
        evidence: { id: "pose-a-threat.danger:to", display: "pose a threat to + noun" },
      }),
    ).toMatchObject({ verdict: "likely_fits", signals: ["joint", "pattern", "noun_unchecked"] });
  });
});

describe("Phase 4 closure: the collocation's authored continuation (R-3)", () => {
  const evidence: GapCandidate = {
    gap: 0,
    type: "collocation",
    senseId: "substantial.large",
    fill: "evidence",
    term: "substantial evidence",
    evidence: { id: "substantial.large:evidence", display: "substantial evidence" },
    span: 1,
    continuation: "that",
    rightWord: "to",
  };

  it("is at most likely fits, naming what the pattern authors", () => {
    expect(collocationVerdict(evidence, window("A substantial ___ to the budget"), [])).toEqual({
      verdict: "likely_fits",
      signals: ["collocation", "continuation_differs"],
      reason:
        "Matches the collocation “substantial evidence”; Lexora’s pattern continues it with “that”, not “to”.",
    });
  });

  it("never raises a verdict: an inflected match stays likely fits, with both reasons", () => {
    expect(
      collocationVerdict(
        { ...evidence, inflected: true },
        window("A substantial ___ to the budget"),
        [],
      ).signals,
    ).toEqual(["collocation", "inflected", "continuation_differs"]);
  });
});
