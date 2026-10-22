import "server-only";

import { isDue, schedule, type Outcome } from "@/learning/scheduler";
import { db } from "@/server/db/client";
import {
  ensureCard,
  findAnswer,
  insertAnswer,
  lockCard,
  updateCard,
  type AnswerRow,
} from "@/server/repositories/review-cards";

/**
 * Recording one review answer (specification §15, steps 4.2–4.7): the persistence primitive the
 * Step 5 review endpoint calls once it has authenticated the learner, rate-limited the request,
 * validated the input and evaluated the answer against the exercise. Everything here happens in
 * one transaction, with the learner's card locked:
 *
 * 1. the sense must be saved by this learner (else `not_saved`); a save without a card (made
 *    before Phase 5) gets its card now: box 0, due since it was saved;
 * 2. a retired sense or item can't be answered (`retired`);
 * 3. once-only: the answer must be for review number `expectedReviews + 1`. A retry of an answer
 *    already recorded with that number and exercise returns the stored answer (`duplicate`) and
 *    changes nothing; anything else for an already-used number is `stale`;
 * 4. the card must be due (`not_due`);
 * 5. the scheduler computes the next state at `now`; the card is updated and the answer logged.
 *
 * `unique (card_id, review_number)` backs the row lock: an answer can never be logged twice.
 */

export type AnswerSubmission = {
  /** The card's `reviews` when the exercise was shown: the answer becomes number + 1. */
  expectedReviews: number;
  exerciseId: string;
  exerciseType: AnswerRow["exerciseType"];
  outcome: Outcome;
  answerMatch: AnswerRow["answerMatch"];
  /** The learner's normalised typed answer; null for a choice. */
  answer: string | null;
  expected: string;
  mistakeId: string | null;
};

export type RecordedAnswer = Pick<
  AnswerRow,
  | "reviewNumber"
  | "exerciseId"
  | "exerciseType"
  | "outcome"
  | "answerMatch"
  | "answer"
  | "expected"
  | "mistakeId"
  | "boxBefore"
  | "boxAfter"
  | "dueAfter"
  | "reviewedAt"
>;

export type RecordAnswerResult =
  | { status: "recorded" | "duplicate"; answer: RecordedAnswer }
  | { status: "not_saved" | "retired" | "stale" | "not_due" };

function recorded(row: AnswerRow): RecordedAnswer {
  return {
    reviewNumber: row.reviewNumber,
    exerciseId: row.exerciseId,
    exerciseType: row.exerciseType,
    outcome: row.outcome,
    answerMatch: row.answerMatch,
    answer: row.answer,
    expected: row.expected,
    mistakeId: row.mistakeId,
    boxBefore: row.boxBefore,
    boxAfter: row.boxAfter,
    dueAfter: row.dueAfter,
    reviewedAt: row.reviewedAt,
  };
}

export async function recordAnswer(
  userId: string,
  senseId: string,
  submission: AnswerSubmission,
  now: Date,
): Promise<RecordAnswerResult> {
  return db.transaction(async (tx) => {
    await ensureCard(tx, userId, senseId);
    const locked = await lockCard(tx, userId, senseId);
    if (!locked) return { status: "not_saved" };
    if (locked.retired) return { status: "retired" };

    const reviewNumber = submission.expectedReviews + 1;
    if (locked.card.reviews !== submission.expectedReviews) {
      const existing = await findAnswer(tx, locked.cardId, reviewNumber);
      return existing && existing.exerciseId === submission.exerciseId
        ? { status: "duplicate", answer: recorded(existing) }
        : { status: "stale" };
    }
    if (!isDue(locked.card, now)) return { status: "not_due" };

    const next = schedule(locked.card, submission.outcome, now);
    await updateCard(tx, locked.cardId, next);
    const row = await insertAnswer(tx, {
      userId,
      cardId: locked.cardId,
      senseId,
      reviewNumber,
      exerciseId: submission.exerciseId,
      exerciseType: submission.exerciseType,
      outcome: submission.outcome,
      answerMatch: submission.answerMatch,
      answer: submission.answer,
      expected: submission.expected,
      mistakeId: submission.mistakeId,
      boxBefore: locked.card.box,
      boxAfter: next.box,
      dueAfter: next.dueAt,
      reviewedAt: now,
    });
    return { status: "recorded", answer: recorded(row) };
  });
}
