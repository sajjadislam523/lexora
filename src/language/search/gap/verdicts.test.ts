import { describe, expect, it } from "vitest";

import { normaliseQuery } from "../../normalise";
import type { MistakeHit } from "../repository";

import { gapWindows, type GapCandidate } from "./candidates";
import { planGaps } from "./reader";
import {
  collocationVerdict,
  framePrepositionVerdict,
  frameVerdict,
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
