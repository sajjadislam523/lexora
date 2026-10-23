import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  INTERVAL_DAYS,
  isDue,
  newCard,
  schedule,
  type Box,
  type CardState,
} from "./scheduler";
import { nextReview, reviewStatus } from "./status";

/** The Leitner scheduler (specification §10), with a fixed clock. */
const SAVED = new Date("2026-10-22T09:00:00.000Z");
const NOW = new Date("2026-10-23T14:30:00.000Z");
const days = (from: Date, n: number) => new Date(from.getTime() + n * DAY_MS);

const card = (box: Box, overrides: Partial<CardState> = {}): CardState => ({
  box,
  dueAt: NOW,
  reviews: box === 0 ? 0 : 3,
  lapses: 1,
  lastReviewedAt: box === 0 ? null : days(NOW, -3),
  ...overrides,
});

describe("newCard", () => {
  it("is box 0, unanswered, due when saved", () => {
    expect(newCard(SAVED)).toEqual({
      box: 0,
      dueAt: SAVED,
      reviews: 0,
      lapses: 0,
      lastReviewedAt: null,
    });
    expect(isDue(newCard(SAVED), SAVED)).toBe(true);
  });

  it("copies the date it's given", () => {
    const saved = new Date(SAVED.getTime());
    const fresh = newCard(saved);
    saved.setTime(0);
    expect(fresh.dueAt).toEqual(SAVED);
  });
});

describe("schedule: correct answers", () => {
  it.each([
    [0, 1, 1],
    [1, 2, 3],
    [2, 3, 7],
    [3, 4, 14],
    [4, 5, 30],
    [5, 5, 30],
  ] as const)("box %i → box %i, next review in %i days", (from, to, interval) => {
    const next = schedule(card(from), "correct", NOW);
    expect(next.box).toBe(to);
    expect(next.dueAt).toEqual(days(NOW, interval));
    expect(INTERVAL_DAYS[to]).toBe(interval);
  });

  it("takes a new card to box 1, back the next day (the first correct answer)", () => {
    expect(schedule(newCard(SAVED), "correct", NOW)).toEqual({
      box: 1,
      dueAt: days(NOW, 1),
      reviews: 1,
      lapses: 0,
      lastReviewedAt: NOW,
    });
  });

  it("stays in box 5 for every further correct answer", () => {
    let state = card(5);
    for (let i = 1; i <= 4; i++) {
      const at = days(NOW, 30 * i);
      state = schedule(state, "correct", at);
      expect(state.box).toBe(5);
      expect(state.dueAt).toEqual(days(at, 30));
    }
  });

  it("counts the answer and records when it was given, without a lapse", () => {
    const next = schedule(card(2, { reviews: 7, lapses: 2 }), "correct", NOW);
    expect(next).toMatchObject({ reviews: 8, lapses: 2, lastReviewedAt: NOW });
  });
});

describe("schedule: wrong answers", () => {
  it.each([0, 1, 2, 3, 4, 5] as const)("box %i → box 1, back the next day", (from) => {
    const next = schedule(card(from), "incorrect", NOW);
    expect(next.box).toBe(1);
    expect(next.dueAt).toEqual(days(NOW, 1));
  });

  it("counts a lapse every time, with no extra penalty for repeated misses", () => {
    let state = card(4, { reviews: 3, lapses: 0 });
    for (let i = 1; i <= 3; i++) {
      const at = days(NOW, i);
      state = schedule(state, "incorrect", at);
      expect(state).toMatchObject({ box: 1, dueAt: days(at, 1), reviews: 3 + i, lapses: i });
    }
  });
});

describe("schedule: time", () => {
  it("uses fixed 24-hour days from the answer time, not calendar days", () => {
    const lateEvening = new Date("2026-10-22T23:59:00.000Z");
    expect(schedule(card(1), "correct", lateEvening).dueAt.toISOString()).toBe(
      "2026-10-25T23:59:00.000Z",
    );
  });

  it("schedules an overdue card from when it was answered, one box at a time", () => {
    const overdue = card(2, { dueAt: days(NOW, -20) });
    const next = schedule(overdue, "correct", NOW);
    expect(next.box).toBe(3);
    expect(next.dueAt).toEqual(days(NOW, 7));
  });

  it("is deterministic and leaves its input unchanged", () => {
    const input = card(3);
    const before = structuredClone(input);
    expect(schedule(input, "correct", NOW)).toEqual(schedule(input, "correct", NOW));
    expect(input).toEqual(before);
  });
});

describe("isDue", () => {
  it("is due exactly at its due time, and after it", () => {
    expect(isDue(card(2, { dueAt: NOW }), NOW)).toBe(true);
    expect(isDue(card(2, { dueAt: new Date(NOW.getTime() - 1) }), NOW)).toBe(true);
  });

  it("isn't due a millisecond before", () => {
    expect(isDue(card(2, { dueAt: new Date(NOW.getTime() + 1) }), NOW)).toBe(false);
  });
});

describe("reviewStatus", () => {
  const status = (state: CardState, flags: { retired?: boolean; hasExercise?: boolean } = {}) =>
    reviewStatus({ card: state, retired: false, hasExercise: true, ...flags }, NOW);

  it("is new for a card never answered, due or not", () => {
    expect(status(newCard(SAVED))).toBe("new");
    expect(status(newCard(days(NOW, 1)))).toBe("new");
  });

  it("is due once an answered card's time has come, whatever its box", () => {
    expect(status(card(1, { dueAt: NOW }))).toBe("due");
    expect(status(card(5, { dueAt: days(NOW, -2) }))).toBe("due");
  });

  it("is learning in boxes 1–3 and known in boxes 4–5 until due", () => {
    const later = days(NOW, 2);
    expect([1, 2, 3, 4, 5].map((box) => status(card(box as Box, { dueAt: later })))).toEqual([
      "learning",
      "learning",
      "learning",
      "known",
      "known",
    ]);
  });

  it("puts retired first, then senses with no exercise", () => {
    expect(status(card(2), { retired: true, hasExercise: false })).toBe("retired");
    expect(status(newCard(SAVED), { hasExercise: false })).toBe("no_exercise");
  });
});

describe("nextReview", () => {
  it("is due once the due time has come, for new and answered cards alike", () => {
    expect(nextReview(newCard(SAVED), NOW)).toEqual({ due: true });
    expect(nextReview(card(3, { dueAt: NOW }), NOW)).toEqual({ due: true });
  });

  it("counts whole days, rounded up, never zero", () => {
    expect(nextReview(card(1, { dueAt: new Date(NOW.getTime() + 1) }), NOW)).toEqual({
      due: false,
      days: 1,
    });
    expect(nextReview(card(1, { dueAt: days(NOW, 1) }), NOW)).toEqual({ due: false, days: 1 });
    expect(
      nextReview(card(2, { dueAt: new Date(NOW.getTime() + 30 * 60 * 60 * 1000) }), NOW),
    ).toEqual({ due: false, days: 2 });
    expect(nextReview(schedule(card(4), "correct", NOW), NOW)).toEqual({ due: false, days: 30 });
  });
});
