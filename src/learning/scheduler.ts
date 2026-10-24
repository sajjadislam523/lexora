/**
 * The Phase 5 review scheduler (docs/specs/phase-5-retrieval-loop.md §10): five Leitner boxes,
 * pure and deterministic. No database, HTTP, React or clock: `now` is always passed in.
 *
 * - Box 0 is a new card, never answered, due as soon as it's saved.
 * - A correct answer moves the card up one box (at most box 5); a wrong one sends it back to box 1.
 * - The next review is the answer time plus the new box's interval: 1, 3, 7, 14 or 30 days.
 *   Intervals are fixed durations (n × 24 hours), never calendar days, so there's no timezone
 *   or daylight-saving arithmetic. An overdue answer is scheduled from when it was given.
 */

export type Box = 0 | 1 | 2 | 3 | 4 | 5;
/** The boxes an answered card can be in. */
export type AnsweredBox = Exclude<Box, 0>;
export type Outcome = "correct" | "incorrect";

/** The persisted state of a card: everything the scheduler needs, and nothing derived. */
export type CardState = {
  box: Box;
  dueAt: Date;
  /** Answers recorded on this card. */
  reviews: number;
  /** Wrong answers recorded on this card. */
  lapses: number;
  lastReviewedAt: Date | null;
};

export const MAX_BOX = 5;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Days until the next review once a card reaches each box (box 0 is due when saved). */
export const INTERVAL_DAYS: Readonly<Record<AnsweredBox, number>> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

/**
 * A new card: box 0, due at `savedAt`. Also how a save made before Phase 5, which has no card
 * yet, is read (§9.4): new, due since it was saved. Nothing is backfilled.
 */
export function newCard(savedAt: Date): CardState {
  return {
    box: 0,
    dueAt: new Date(savedAt.getTime()),
    reviews: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

/** The card after one answer at `now`. Doesn't modify `card`. */
export function schedule(card: CardState, outcome: Outcome, now: Date): CardState {
  // After any answer the card is in box 1–5; box 0 only ever means "never answered".
  const box = outcome === "correct" ? (Math.min(card.box + 1, MAX_BOX) as AnsweredBox) : 1;
  return {
    box,
    dueAt: new Date(now.getTime() + INTERVAL_DAYS[box] * DAY_MS),
    reviews: card.reviews + 1,
    lapses: card.lapses + (outcome === "incorrect" ? 1 : 0),
    lastReviewedAt: new Date(now.getTime()),
  };
}

/** Whether the card can be answered at `now`: its next review time has come (`dueAt ≤ now`). */
export function isDue(card: Pick<CardState, "dueAt">, now: Date) {
  return card.dueAt.getTime() <= now.getTime();
}
