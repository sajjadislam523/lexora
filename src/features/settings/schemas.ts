import { z } from "zod";

export const TARGET_BANDS = [
  "4.0",
  "4.5",
  "5.0",
  "5.5",
  "6.0",
  "6.5",
  "7.0",
  "7.5",
  "8.0",
  "8.5",
  "9.0",
] as const;
export const FOCUS_SKILLS = ["writing", "speaking", "both"] as const;

/** Form values arrive as strings; empty means "not set". Shared by the form and the server action. */
export const learnerProfileSchema = z.object({
  targetBand: z
    .union([z.literal(""), z.enum(TARGET_BANDS, "Choose a band between 4.0 and 9.0")])
    .transform((v) => (v === "" ? null : v)),
  testDate: z
    .union([z.literal(""), z.iso.date("Enter a valid date")])
    .transform((v) => (v === "" ? null : v))
    .refine(
      (v) => v === null || (v >= "2000-01-01" && v <= "2100-12-31"),
      "Enter a realistic date",
    ),
  focusSkill: z
    .union([z.literal(""), z.enum(FOCUS_SKILLS, "Choose writing, speaking or both")])
    .transform((v) => (v === "" ? null : v)),
});

export type LearnerProfileInput = z.output<typeof learnerProfileSchema>;

export const nameSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer"),
});

export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };
