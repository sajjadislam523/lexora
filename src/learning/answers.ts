/**
 * Checking a review answer against an exercise's authored key (specification §13). Deterministic
 * and deliberately narrow: an answer counts only if it is the expected answer, another authored
 * form of the item, an authored accepted answer, or — for a choice — the right option. There is
 * no fuzzy matching, stemming, spelling correction or synonym lookup.
 */
import type { ExerciseKey } from "./exercises";

/**
 * The only normalisation applied, to typed answers and authored values alike: Unicode NFKC,
 * lower case, curly apostrophes made straight, spaces collapsed, and punctuation removed only
 * at the ends ("However," → "however"). Words and the punctuation inside them are unchanged.
 */
export function normaliseAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** How the answer was read: the scheduler uses `outcome`; `match` and `mistakeId` explain it. */
export type AnswerResult =
  | {
      valid: true;
      outcome: "correct" | "incorrect";
      match: "expected" | "form" | "accepted" | "mistake" | "unrecognised";
      /** The authored mistake the answer showed. */
      mistakeId: string | null;
      /** The normalised typed answer (null for a choice), as the review log stores it. */
      answer: string | null;
    }
  /** Empty after normalisation, or not an option: not an answer at all. */
  | { valid: false };

export function evaluateAnswer(key: ExerciseKey, given: string): AnswerResult {
  if (key.kind === "choice") {
    if (given === key.correctOption) {
      return { valid: true, outcome: "correct", match: "expected", mistakeId: null, answer: null };
    }
    if (given === key.wrongOption) {
      return {
        valid: true,
        outcome: "incorrect",
        match: "mistake",
        mistakeId: key.mistakeId,
        answer: null,
      };
    }
    return { valid: false };
  }

  const answer = normaliseAnswer(given);
  if (!answer) return { valid: false };
  const correct = (match: "expected" | "form" | "accepted") =>
    ({ valid: true, outcome: "correct", match, mistakeId: null, answer }) as const;
  if (answer === normaliseAnswer(key.expected)) return correct("expected");
  if (key.forms.includes(answer)) return correct("form");
  if (key.accepted.includes(answer)) return correct("accepted");
  const mistake = key.mistakes.find((m) => m.answer === answer);
  return {
    valid: true,
    outcome: "incorrect",
    match: mistake ? "mistake" : "unrecognised",
    mistakeId: mistake?.mistakeId ?? null,
    answer,
  };
}
