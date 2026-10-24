import "server-only";

import { z } from "zod";

import { evaluateAnswer } from "@/learning/answers";
import { exerciseFor, type Exercise, type ExercisePrompt } from "@/learning/exercises";
import { isDue, schedule, type Outcome } from "@/learning/scheduler";
import { nextReview, type NextReview } from "@/learning/status";
import { languageHref } from "@/language/links";
import { db } from "@/server/db/client";
import { senseIdSchema } from "@/server/http/responses";
import { describeEvidence, sameResponse, type MistakeEvidence } from "@/server/learning/evidence";
import { loadPracticeMaterial, loadSenseNotes } from "@/server/repositories/language/practice";
import {
  ensureCard,
  findAnswer,
  insertAnswer,
  lockCard,
  recurringMistakes,
  reviewQueue,
  updateCard,
  type AnswerRow,
  type QueueEntry,
} from "@/server/repositories/review-cards";
import { countSavedSenses } from "@/server/repositories/saved-senses";

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
 * 5. a pending submission is evaluated now, against the exercise for `expectedReviews`
 *    (`exercise_changed` when that isn't the exercise answered, `invalid_answer` when the answer
 *    isn't one at all — nothing is recorded for either);
 * 6. the scheduler computes the next state at `now`; the card is updated and the answer logged.
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

/** What evaluating an answer adds to the review number and exercise it was given for. */
export type Evaluation = Omit<AnswerSubmission, "expectedReviews" | "exerciseId">;

/** An answer not yet checked: `evaluate` runs inside the transaction, once the card is due. */
export type PendingSubmission = {
  expectedReviews: number;
  exerciseId: string;
  evaluate: () => Evaluation | "exercise_changed" | "invalid_answer";
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
  | {
      status: "not_saved" | "retired" | "stale" | "not_due" | "exercise_changed" | "invalid_answer";
    };

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
  submission: AnswerSubmission | PendingSubmission,
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

    const evaluation = "evaluate" in submission ? submission.evaluate() : submission;
    if (typeof evaluation === "string") return { status: evaluation };
    const next = schedule(locked.card, evaluation.outcome, now);
    await updateCard(tx, locked.cardId, next);
    const row = await insertAnswer(tx, {
      userId,
      cardId: locked.cardId,
      senseId,
      reviewNumber,
      exerciseId: submission.exerciseId,
      exerciseType: evaluation.exerciseType,
      outcome: evaluation.outcome,
      answerMatch: evaluation.answerMatch,
      answer: evaluation.answer,
      expected: evaluation.expected,
      mistakeId: evaluation.mistakeId,
      boxBefore: locked.card.box,
      boxAfter: next.box,
      dueAfter: next.dueAt,
      reviewedAt: now,
    });
    return { status: "recorded", answer: recorded(row) };
  });
}

// ── The review session (specification §14, §15) ──────────────────────────────────────────────

/** Exercises in one session: two or three minutes. */
export const REVIEW_SESSION_SIZE = 5;
/** Rows read for a session: spare ones cover senses that turn out to have no exercise. */
const QUEUE_LIMIT = 10;

/**
 * A prompt as the browser gets it. A typed exercise leaves out the headword, which would give
 * the answer away; a "which is correct?" shows it, since both options contain it.
 */
export type ReviewPrompt = Omit<ExercisePrompt, "term"> & { term?: string };

/** One exercise of a session, as the browser gets it: the prompt only, never the key. */
export type ReviewItem = {
  senseId: string;
  /** The card's answers so far: the answer is recorded as review number + 1. */
  expectedReviews: number;
  prompt: ReviewPrompt;
};

function browserPrompt({ term, ...prompt }: ExercisePrompt): ReviewPrompt {
  return prompt.type === "mistake" ? { ...prompt, term } : prompt;
}

export type ReviewSession =
  | {
      kind: "session";
      items: ReviewItem[];
      /** More is due than one session holds. */ more: boolean;
    }
  | { kind: "empty" }
  | { kind: "caught_up"; nextReview: NextReview | null };

/** The queue's entries that have an exercise, each with the exercise for its next review. */
async function withExercises(queue: QueueEntry[]) {
  const materials = new Map(
    (
      await loadPracticeMaterial(
        db,
        queue.map((entry) => entry.senseId),
      )
    ).map((material) => [material.senseId, material]),
  );
  return queue.flatMap((entry) => {
    const material = materials.get(entry.senseId);
    const exercise = material ? exerciseFor(material, entry.card.reviews) : null;
    return exercise ? [{ entry, exercise }] : [];
  });
}

/**
 * The learner's review session at `now` (§14): up to five due senses that have an exercise, in
 * review order, each with the exercise its card is on. When nothing is due, whether anything is
 * saved at all, and when the next review comes. Reads only; a card is created at its first answer.
 */
export async function loadReviewSession(userId: string, now: Date): Promise<ReviewSession> {
  const due = await withExercises(
    await reviewQueue(userId, now, { when: "due", limit: QUEUE_LIMIT }),
  );
  if (due.length > 0) {
    return {
      kind: "session",
      items: due.slice(0, REVIEW_SESSION_SIZE).map(({ entry, exercise }) => ({
        senseId: entry.senseId,
        expectedReviews: entry.card.reviews,
        prompt: browserPrompt(exercise.prompt),
      })),
      more: due.length > REVIEW_SESSION_SIZE,
    };
  }
  if ((await countSavedSenses(userId)) === 0) return { kind: "empty" };
  const [upcoming] = await withExercises(
    await reviewQueue(userId, now, { when: "upcoming", limit: QUEUE_LIMIT }),
  );
  return { kind: "caught_up", nextReview: upcoming ? nextReview(upcoming.entry.card, now) : null };
}

/** What the learner sees after answering: from the server's record and authored content only. */
export type ReviewFeedback = {
  /** The answer had already been recorded: this is the stored result, not a new one. */
  duplicate: boolean;
  outcome: Outcome;
  match: AnswerRow["answerMatch"];
  /** The answer as the sentence has it, or the correct version of a "which is correct?". */
  expected: string;
  /** Other answers the content accepts in this blank. */
  accepted: string[];
  /** The matched mistake's explanation, the pattern's note, or the sense's best-when. */
  explanation: string | null;
  /** A preposition exercise's pattern, in full. */
  pattern: string | null;
  term: string;
  senseLabel: string | null;
  /** The language page, at this meaning. */
  href: string | null;
  nextReview: NextReview;
  /** Set when this wrong answer makes a recurring mistake (§16): the same one twice in 30 days. */
  evidence: MistakeEvidence | null;
};

/**
 * The body of `POST /api/review/answers` (§20): the sense, the exercise and the review number it
 * was shown at, and the answer. Strict: any other key — a user id, a verdict, a box — is refused.
 */
export const answerRequestSchema = z
  .object({
    senseId: senseIdSchema,
    exerciseId: z.string().regex(/^(term|preposition|mistake):[a-z0-9.:-]{1,160}$/),
    expectedReviews: z.number().int().min(0).max(100_000),
    // Typed text, or an option id (`a` / `b`) for a choice; the exercise decides which it must be.
    answer: z.string().trim().min(1).max(80),
  })
  .strict();

export type AnswerInput = z.infer<typeof answerRequestSchema>;

export type ReviewAnswerResult =
  | { status: "recorded" | "duplicate"; feedback: ReviewFeedback }
  | { status: Exclude<RecordAnswerResult["status"], "recorded" | "duplicate"> };

function explanationFor(
  exercise: Exercise | null,
  mistakes: { id: string; explanation: string }[],
  answer: RecordedAnswer,
  bestWhen: string | null,
) {
  const mistake = answer.mistakeId
    ? mistakes.find((m) => m.id === answer.mistakeId)?.explanation
    : undefined;
  if (answer.exerciseType === "mistake") return exercise?.explanation ?? mistake ?? null;
  if (answer.exerciseType === "preposition") return mistake ?? exercise?.explanation ?? null;
  if (answer.outcome === "correct") return null;
  return mistake ?? bestWhen;
}

/**
 * Answers one review (§15): the exercise is regenerated for `expectedReviews` from authored
 * content, the answer is checked against its key and recorded once, in one transaction with the
 * card locked. The feedback comes from the recorded answer, so a retry gets the same result.
 */
export async function answerReview(
  userId: string,
  input: AnswerInput,
  now: Date,
): Promise<ReviewAnswerResult> {
  const [[material], [notes]] = await Promise.all([
    loadPracticeMaterial(db, [input.senseId]),
    loadSenseNotes(db, [input.senseId]),
  ]);
  const exercise = material ? exerciseFor(material, input.expectedReviews) : null;

  const result = await recordAnswer(
    userId,
    input.senseId,
    {
      expectedReviews: input.expectedReviews,
      exerciseId: input.exerciseId,
      evaluate: () => {
        if (!exercise || exercise.prompt.id !== input.exerciseId) return "exercise_changed";
        const checked = evaluateAnswer(exercise.key, input.answer);
        if (!checked.valid) return "invalid_answer";
        return {
          exerciseType: exercise.prompt.type,
          outcome: checked.outcome,
          answerMatch: checked.match,
          answer: checked.answer,
          expected: exercise.key.expected,
          mistakeId: checked.mistakeId,
        };
      },
    },
    now,
  );
  if (!("answer" in result)) return result;

  const { answer } = result;
  // Evidence as of the answer itself, so a retry gets the same feedback as the first request.
  const evidence =
    answer.outcome === "incorrect"
      ? ((await recurringMistakes(db, userId, [input.senseId], answer.reviewedAt))
          .filter((recurring) => sameResponse(recurring, answer))
          .map((recurring) => describeEvidence(recurring, material))[0] ?? null)
      : null;
  // The exercise only if it's still the one answered (content can change between retries).
  const shown = exercise?.prompt.id === answer.exerciseId ? exercise : null;
  const pattern =
    answer.exerciseType === "preposition" && material
      ? (material.patterns.find(
          (p) => p.id === material.examples.find((e) => e.id === shown?.source)?.patternId,
        )?.pattern ?? null)
      : null;
  return {
    status: result.status,
    feedback: {
      duplicate: result.status === "duplicate",
      outcome: answer.outcome,
      match: answer.answerMatch,
      expected: answer.expected,
      accepted: shown?.key.kind === "typed" ? shown.key.accepted : [],
      explanation: explanationFor(shown, material?.mistakes ?? [], answer, notes?.bestWhen ?? null),
      pattern,
      term: material?.term ?? "",
      senseLabel: notes?.label ?? null,
      href: notes
        ? languageHref(notes.slug, { id: input.senseId, label: notes.label ?? undefined })
        : null,
      nextReview: nextReview({ dueAt: answer.dueAfter }, now),
      evidence,
    },
  };
}
