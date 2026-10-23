import "server-only";

import type { PracticeMaterial } from "@/learning/exercises";
import type { RecurringMistake } from "@/server/repositories/review-cards";

/**
 * A recurring mistake as the learner sees it (specification §16): an authored mistake shows its
 * own wrong and right versions and explanation, read from content now (never copied into the
 * learner's data); a repeated unrecognised typed answer shows what was typed and what Lexora was
 * looking for. No ids.
 */
export type MistakeEvidence = {
  /** The authored mistake (`chose`) or an exact typed answer Lexora doesn't list (`typed`). */
  kind: "authored" | "typed";
  wrong: string;
  right: string;
  /** The authored explanation; null for a typed answer. */
  why: string | null;
  /** Times in the last 30 days. */
  times: number;
};

/** Null when the authored mistake is no longer in the sense's content. */
export function describeEvidence(
  recurring: RecurringMistake,
  material: PracticeMaterial | undefined,
): MistakeEvidence | null {
  if (recurring.mistakeId === null) {
    if (recurring.answer === null) return null;
    return {
      kind: "typed",
      wrong: recurring.answer,
      right: recurring.expected,
      why: null,
      times: recurring.times,
    };
  }
  const mistake = material?.mistakes.find((m) => m.id === recurring.mistakeId);
  if (!mistake) return null;
  return {
    kind: "authored",
    wrong: mistake.wrong,
    right: mistake.right,
    why: mistake.explanation,
    times: recurring.times,
  };
}

/** Whether a recorded answer is this recurring mistake: the same response key (§16). */
export function sameResponse(
  recurring: RecurringMistake,
  answer: { mistakeId: string | null; answer: string | null },
) {
  return answer.mistakeId !== null
    ? recurring.mistakeId === answer.mistakeId
    : recurring.mistakeId === null && recurring.answer === answer.answer;
}
