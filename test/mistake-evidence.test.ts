import { describe, expect, it } from "vitest";

import type { PracticeMaterial } from "@/learning/exercises";
import { describeEvidence, sameResponse } from "@/server/learning/evidence";
import type { RecurringMistake } from "@/server/repositories/review-cards";

/**
 * Turning a recurring mistake into what the learner sees (specification §16): authored text read
 * from content, never copied; a typed answer quoted exactly; and the response key that decides
 * which recorded answers are "the same mistake".
 */
const recurring = (overrides: Partial<RecurringMistake> = {}): RecurringMistake => ({
  senseId: "rely.depend",
  mistakeId: "rely.depend:of",
  answer: null,
  expected: "rely on",
  times: 2,
  lastAt: new Date("2026-11-02T12:00:00Z"),
  ...overrides,
});

const material = {
  mistakes: [
    {
      id: "rely.depend:of",
      wrong: "rely of",
      right: "rely on",
      type: "preposition",
      explanation: "Rely takes on.",
    },
  ],
} as unknown as PracticeMaterial;

describe("personal mistake evidence", () => {
  it("shows an authored mistake from the content", () => {
    expect(describeEvidence(recurring(), material)).toEqual({
      kind: "authored",
      wrong: "rely of",
      right: "rely on",
      why: "Rely takes on.",
      times: 2,
    });
  });

  it("shows a repeated typed answer against what Lexora was looking for", () => {
    expect(describeEvidence(recurring({ mistakeId: null, answer: "at" }), material)).toEqual({
      kind: "typed",
      wrong: "at",
      right: "rely on",
      why: null,
      times: 2,
    });
  });

  it("shows nothing when the authored mistake is gone from the content", () => {
    expect(describeEvidence(recurring({ mistakeId: "rely.depend:gone" }), material)).toBeNull();
    expect(describeEvidence(recurring(), undefined)).toBeNull();
  });

  it("matches an answer by its authored mistake, or by the exact typed answer", () => {
    const authored = recurring();
    const typed = recurring({ mistakeId: null, answer: "at" });
    expect(sameResponse(authored, { mistakeId: "rely.depend:of", answer: "relly of" })).toBe(true);
    expect(sameResponse(authored, { mistakeId: "rely.depend:other", answer: null })).toBe(false);
    expect(sameResponse(typed, { mistakeId: null, answer: "at" })).toBe(true);
    expect(sameResponse(typed, { mistakeId: null, answer: "in" })).toBe(false);
    expect(sameResponse(typed, { mistakeId: "rely.depend:of", answer: "at" })).toBe(false);
  });
});
