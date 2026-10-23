import { beforeAll, describe, expect, it } from "vitest";

import { generateExercises, type PracticeMaterial } from "@/learning/exercises";
import { buildRows } from "@/server/content/build";
import { practiceMaterialFromContent } from "@/server/content/practice";
import { answerRequestSchema } from "@/server/learning/review";

import { loadPublishedContent } from "./published-content";

/**
 * The review endpoint's body (Phase 5 specification §20): strict, and wide enough for every
 * exercise the published content generates, so no real answer is refused as malformed.
 */
let materials: PracticeMaterial[];

beforeAll(async () => {
  materials = practiceMaterialFromContent(buildRows(await loadPublishedContent()));
});

const body = (overrides: Record<string, unknown> = {}) => ({
  senseId: "significant.notable",
  exerciseId: "term:significant.notable:ex1",
  expectedReviews: 0,
  answer: "significant",
  ...overrides,
});

describe("review answer request", () => {
  it("accepts every published exercise, with a typed answer or an option", () => {
    const exercises = materials.flatMap((material) => generateExercises(material));
    expect(exercises).toHaveLength(178);
    for (const { prompt } of exercises) {
      const answer = prompt.type === "mistake" ? "a" : "x";
      const parsed = answerRequestSchema.safeParse(
        body({ senseId: prompt.senseId, exerciseId: prompt.id, answer }),
      );
      expect(parsed.success, prompt.id).toBe(true);
    }
  });

  it("trims the answer and keeps it short", () => {
    expect(answerRequestSchema.parse(body({ answer: "  rely  " })).answer).toBe("rely");
    for (const answer of ["", "   ", "x".repeat(81), 3, null]) {
      expect(answerRequestSchema.safeParse(body({ answer })).success, String(answer)).toBe(false);
    }
  });

  it("refuses anything the server decides, and malformed ids", () => {
    for (const extra of [
      { userId: "someone" },
      { correct: true },
      { nextBox: 5 },
      { cardId: "x" },
    ]) {
      expect(answerRequestSchema.safeParse(body(extra)).success, Object.keys(extra)[0]).toBe(false);
    }
    for (const [key, value] of [
      ["senseId", "Significant.Notable"],
      ["senseId", "significant"],
      ["exerciseId", "hint:significant.notable:ex1"],
      ["exerciseId", "term:SIGNIFICANT"],
      ["expectedReviews", -1],
      ["expectedReviews", 1.5],
      ["expectedReviews", "0"],
      ["expectedReviews", 100_001],
    ] as const) {
      expect(answerRequestSchema.safeParse(body({ [key]: value })).success, `${key}=${value}`).toBe(
        false,
      );
    }
  });
});
