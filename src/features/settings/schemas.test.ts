import { describe, expect, it } from "vitest";

import { learnerProfileSchema, nameSchema } from "./schemas";

describe("learner profile schema", () => {
  it("turns empty fields into null", () => {
    expect(learnerProfileSchema.parse({ targetBand: "", testDate: "", focusSkill: "" })).toEqual({
      targetBand: null,
      testDate: null,
      focusSkill: null,
    });
  });

  it("accepts valid values", () => {
    expect(
      learnerProfileSchema.parse({
        targetBand: "7.5",
        testDate: "2027-03-14",
        focusSkill: "speaking",
      }),
    ).toEqual({ targetBand: "7.5", testDate: "2027-03-14", focusSkill: "speaking" });
  });

  it.each([
    { targetBand: "9.5", testDate: "", focusSkill: "" },
    { targetBand: "7.3", testDate: "", focusSkill: "" },
    { targetBand: "", testDate: "14/03/2027", focusSkill: "" },
    { targetBand: "", testDate: "1850-01-01", focusSkill: "" },
    { targetBand: "", testDate: "", focusSkill: "reading" },
  ])("rejects invalid input %o", (input) => {
    expect(learnerProfileSchema.safeParse(input).success).toBe(false);
  });
});

describe("name schema", () => {
  it("trims and bounds the name", () => {
    expect(nameSchema.parse({ name: "  Maya  " }).name).toBe("Maya");
    expect(nameSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(nameSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });
});
