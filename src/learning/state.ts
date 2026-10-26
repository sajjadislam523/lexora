import type { CardState, Outcome } from "./scheduler";
import { isDue } from "./scheduler";
import { learningStage, nextReview, type LearningStage, type NextReview } from "./status";

/**
 * A learner's state for one saved sense (Phase 7.1): what the scheduler and the review log say,
 * in one place, with the reason in words. Pure and derived, never stored:
 *
 * - **stage** comes from the review card, by the rule the bank uses (`learningStage`): `new`
 *   until the card's first answer, `known` in box 4 or 5, `learning` otherwise;
 * - **due** and the next review come from the card's due time, as the review session uses them;
 * - **evidence** comes from the learner's recorded answers on the sense in `review_log`,
 *   including answers given before the sense was removed and saved again (the log outlives the
 *   card; specification §9.4: "History stays and still counts as evidence").
 *
 * The reason describes what was observed ("Missed the last 2 times"), never a judgement of the
 * learner, and never the box or other internals.
 */

/** What the learner's recorded answers on a sense show. */
export type PracticeEvidence = {
  /** Recorded answers. */
  attempts: number;
  correct: number;
  incorrect: number;
  /** The latest recorded answer's time; null when there are none. */
  lastPractisedAt: Date | null;
  /** The latest answer's outcome, and how many answers in a row ending with it had that outcome. */
  latest: { outcome: Outcome; inARow: number } | null;
};

/** Shared by every sense without answers, so frozen. */
export const NO_EVIDENCE: PracticeEvidence = Object.freeze({
  attempts: 0,
  correct: 0,
  incorrect: 0,
  lastPractisedAt: null,
  latest: null,
});

/**
 * The evidence in a list of recorded answers, in any order: the reference rule. Lexora computes
 * the same thing in SQL (`learningEvidence` in src/server/repositories/review-cards.ts); tests
 * assert the two agree. Answers are ordered by time, then by review number.
 */
export function evidenceFrom(
  answers: readonly { outcome: Outcome; reviewedAt: Date; reviewNumber: number }[],
): PracticeEvidence {
  if (answers.length === 0) return NO_EVIDENCE;
  const latestFirst = [...answers].sort(
    (a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime() || b.reviewNumber - a.reviewNumber,
  );
  const latest = latestFirst[0]!;
  const change = latestFirst.findIndex((answer) => answer.outcome !== latest.outcome);
  const correct = answers.filter((answer) => answer.outcome === "correct").length;
  return {
    attempts: answers.length,
    correct,
    incorrect: answers.length - correct,
    lastPractisedAt: new Date(latest.reviewedAt.getTime()),
    latest: { outcome: latest.outcome, inARow: change === -1 ? answers.length : change },
  };
}

/** Why a sense is in its stage, as observed facts. */
export type LearningReason =
  /** No recorded answer on the sense. */
  | { code: "not_practised" }
  /** Answers were recorded before the sense was removed; this save's card has none yet. */
  | { code: "saved_again" }
  /** The latest answer was wrong; `times` wrong answers in a row. */
  | { code: "missed"; times: number }
  /** The latest answer was right; `times` right answers in a row. */
  | { code: "correct"; times: number };

export function learningReason(stage: LearningStage, evidence: PracticeEvidence): LearningReason {
  if (evidence.latest === null) return { code: "not_practised" };
  if (stage === "new") return { code: "saved_again" };
  return evidence.latest.outcome === "incorrect"
    ? { code: "missed", times: evidence.latest.inARow }
    : { code: "correct", times: evidence.latest.inARow };
}

/** "Not practised yet.", "Missed last time.", "Answered correctly the last 3 times." */
export function learningReasonText(reason: LearningReason) {
  switch (reason.code) {
    case "not_practised":
      return "Not practised yet.";
    case "saved_again":
      return "Saved again, so its reviews start over.";
    case "missed":
      return reason.times === 1 ? "Missed last time." : `Missed the last ${reason.times} times.`;
    case "correct":
      return reason.times === 1
        ? "Answered correctly last time."
        : `Answered correctly the last ${reason.times} times.`;
  }
}

export type LearningState = {
  senseId: string;
  savedAt: Date;
  stage: LearningStage;
  /** Its review time has come and it can be reviewed now. Never true for a retired sense. */
  due: boolean;
  /** The sense or its item is no longer published, so it isn't reviewed. */
  retired: boolean;
  /** Null for a retired sense. */
  nextReview: NextReview | null;
  evidence: PracticeEvidence;
  reason: LearningReason;
};

/** A saved sense's learning state at `now`, from its card (or a new one) and its evidence. */
export function learningState(
  input: {
    senseId: string;
    savedAt: Date;
    card: CardState;
    retired: boolean;
    evidence: PracticeEvidence;
  },
  now: Date,
): LearningState {
  const stage = learningStage(input.card);
  return {
    senseId: input.senseId,
    savedAt: input.savedAt,
    stage,
    due: !input.retired && isDue(input.card, now),
    retired: input.retired,
    nextReview: input.retired ? null : nextReview(input.card, now),
    evidence: input.evidence,
    reason: learningReason(stage, input.evidence),
  };
}
