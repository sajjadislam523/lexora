import { describe, expect, it } from "vitest";

import { DAY_MS, newCard, schedule, type CardState, type Outcome } from "./scheduler";
import {
  evidenceFrom,
  learningReason,
  learningReasonText,
  learningState,
  NO_EVIDENCE,
  type LearningState,
} from "./state";
import { learningStage, reviewStatus } from "./status";

/**
 * The Phase 7.1 learning state, with a fixed clock: answers are run through the real scheduler
 * and logged, as `recordAnswer` does, so every state is one the review loop can produce.
 */
const SAVED = new Date("2026-10-22T09:00:00.000Z");
const days = (from: Date, n: number) => new Date(from.getTime() + n * DAY_MS);

type Answer = { outcome: Outcome; reviewedAt: Date; reviewNumber: number };

/** Answers each outcome as soon as the card is due; returns the card, the log and the time. */
function practise(outcomes: Outcome[], start: CardState = newCard(SAVED), log: Answer[] = []) {
  let card = start;
  const answers = [...log];
  for (const outcome of outcomes) {
    const at = new Date(Math.max(card.dueAt.getTime(), SAVED.getTime()) + 60_000);
    card = schedule(card, outcome, at);
    answers.push({ outcome, reviewedAt: at, reviewNumber: card.reviews });
  }
  return { card, answers };
}

function stateAfter(outcomes: Outcome[], now?: Date, retired = false): LearningState {
  const { card, answers } = practise(outcomes);
  return learningState(
    {
      senseId: "significant.notable",
      savedAt: SAVED,
      card,
      retired,
      evidence: evidenceFrom(answers),
    },
    now ?? card.lastReviewedAt ?? SAVED,
  );
}

const C: Outcome = "correct";
const X: Outcome = "incorrect";

describe("learningStage", () => {
  it("is new until the card's first answer, known in box 4–5, learning otherwise", () => {
    expect(learningStage({ box: 0, reviews: 0 })).toBe("new");
    expect(learningStage({ box: 1, reviews: 1 })).toBe("learning");
    expect(learningStage({ box: 3, reviews: 5 })).toBe("learning");
    expect(learningStage({ box: 4, reviews: 4 })).toBe("known");
    expect(learningStage({ box: 5, reviews: 9 })).toBe("known");
  });

  it("is the stage reviewStatus reports whenever a card isn't due", () => {
    for (const outcomes of [[], [C], [X], [C, C, C, C], [C, X, C], [X, X, X]] as Outcome[][]) {
      const { card } = practise(outcomes);
      const notDue = days(card.dueAt, -0.5);
      const status = reviewStatus({ card, retired: false, hasExercise: true }, notDue);
      expect(status).toBe(learningStage(card));
    }
  });
});

describe("evidenceFrom", () => {
  it("is empty without answers", () => {
    expect(evidenceFrom([])).toEqual(NO_EVIDENCE);
  });

  it("counts answers and the run the latest one ends", () => {
    const { answers } = practise([C, X, C, C]);
    expect(evidenceFrom(answers)).toEqual({
      attempts: 4,
      correct: 3,
      incorrect: 1,
      lastPractisedAt: answers[3]!.reviewedAt,
      latest: { outcome: "correct", inARow: 2 },
    });
  });

  it("counts a run that covers every answer", () => {
    expect(evidenceFrom(practise([X, X, X]).answers).latest).toEqual({
      outcome: "incorrect",
      inARow: 3,
    });
  });

  it("doesn't depend on the order it's given answers in", () => {
    const { answers } = practise([X, C, C, X, X]);
    expect(evidenceFrom([...answers].reverse())).toEqual(evidenceFrom(answers));
  });

  it("orders answers at the same time by review number", () => {
    const at = days(SAVED, 1);
    const evidence = evidenceFrom([
      { outcome: "incorrect", reviewedAt: at, reviewNumber: 2 },
      { outcome: "correct", reviewedAt: at, reviewNumber: 1 },
    ]);
    expect(evidence.latest).toEqual({ outcome: "incorrect", inARow: 1 });
  });
});

describe("learningState", () => {
  it("a new save: not practised, new and due", () => {
    const state = stateAfter([], SAVED);
    expect(state).toMatchObject({
      stage: "new",
      due: true,
      retired: false,
      nextReview: { due: true },
      evidence: NO_EVIDENCE,
      reason: { code: "not_practised" },
    });
    expect(learningReasonText(state.reason)).toBe("Not practised yet.");
  });

  it("a first correct answer: learning, back in a day", () => {
    const state = stateAfter([C]);
    expect(state).toMatchObject({
      stage: "learning",
      due: false,
      nextReview: { due: false, days: 1 },
      evidence: { attempts: 1, correct: 1, incorrect: 0 },
      reason: { code: "correct", times: 1 },
    });
    expect(learningReasonText(state.reason)).toBe("Answered correctly last time.");
  });

  it("a first wrong answer: learning, missed last time", () => {
    const state = stateAfter([X]);
    expect(state).toMatchObject({
      stage: "learning",
      evidence: { attempts: 1, correct: 0, incorrect: 1 },
      reason: { code: "missed", times: 1 },
    });
    expect(learningReasonText(state.reason)).toBe("Missed last time.");
  });

  it("repeated misses: still learning, with the misses in a row as the reason", () => {
    const state = stateAfter([C, C, X, X, X]);
    expect(state.stage).toBe("learning");
    expect(state.evidence).toMatchObject({ attempts: 5, correct: 2, incorrect: 3 });
    expect(state.reason).toEqual({ code: "missed", times: 3 });
    expect(learningReasonText(state.reason)).toBe("Missed the last 3 times.");
  });

  it("consistent correct answers: known after four from new", () => {
    expect(stateAfter([C, C, C]).stage).toBe("learning");
    const state = stateAfter([C, C, C, C]);
    expect(state.stage).toBe("known");
    expect(learningReasonText(state.reason)).toBe("Answered correctly the last 4 times.");
  });

  it("consistent correct answers: known after three following a miss", () => {
    expect(stateAfter([C, C, X, C, C]).stage).toBe("learning");
    const state = stateAfter([C, C, X, C, C, C]);
    expect(state.stage).toBe("known");
    expect(state.reason).toEqual({ code: "correct", times: 3 });
  });

  it("one miss takes a known sense back to learning", () => {
    expect(stateAfter([C, C, C, C, C, X])).toMatchObject({
      stage: "learning",
      reason: { code: "missed", times: 1 },
    });
  });

  it("is due exactly when the review session can take it, and keeps its stage", () => {
    const { card, answers } = practise([C, C, C, C]);
    const evidence = evidenceFrom(answers);
    const input = { senseId: "s", savedAt: SAVED, card, retired: false, evidence };
    const before = learningState(input, new Date(card.dueAt.getTime() - 1));
    const at = learningState(input, card.dueAt);
    expect(before).toMatchObject({ due: false, stage: "known", nextReview: { due: false } });
    expect(at).toMatchObject({ due: true, stage: "known", nextReview: { due: true } });
    expect(reviewStatus({ card, retired: false, hasExercise: true }, card.dueAt)).toBe("due");
  });

  it("a retired sense is never due and has no next review", () => {
    const state = stateAfter([X], days(SAVED, 60), true);
    expect(state).toMatchObject({ retired: true, due: false, nextReview: null, stage: "learning" });
  });

  it("saved again: the new card is new, and the earlier answers stay as evidence", () => {
    const earlier = practise([C, C, X]).answers;
    const state = learningState(
      {
        senseId: "s",
        savedAt: days(SAVED, 10),
        card: newCard(days(SAVED, 10)),
        retired: false,
        evidence: evidenceFrom(earlier),
      },
      days(SAVED, 10),
    );
    expect(state).toMatchObject({ stage: "new", due: true, evidence: { attempts: 3 } });
    expect(state.reason).toEqual({ code: "saved_again" });
    expect(learningReasonText(state.reason)).toBe("Saved again, so its reviews start over.");
  });

  it("a run after saving again continues across the earlier answers", () => {
    const saved = days(SAVED, 10);
    const earlier = practise([X, C, C]).answers;
    const { card, answers } = practise([C], newCard(saved), earlier);
    const state = learningState(
      { senseId: "s", savedAt: saved, card, retired: false, evidence: evidenceFrom(answers) },
      card.lastReviewedAt!,
    );
    expect(state.stage).toBe("learning");
    expect(state.evidence.attempts).toBe(4);
    expect(state.reason).toEqual({ code: "correct", times: 3 });
  });
});

describe("learningReasonText", () => {
  it("describes what was observed, never internals or a judgement", () => {
    const reasons = [
      learningReason("new", NO_EVIDENCE),
      learningReason("new", evidenceFrom(practise([X]).answers)),
      learningReason("learning", evidenceFrom(practise([X, X]).answers)),
      learningReason("known", evidenceFrom(practise([C, C, C, C, C]).answers)),
    ];
    for (const text of reasons.map(learningReasonText)) {
      expect(text).not.toMatch(/box|score|weak|level|band|%/i);
      expect(text).toMatch(/\.$/);
    }
  });
});
