import { DAY_MS, isDue, type CardState } from "./scheduler";

/**
 * A card's status for the learner (specification §10.3), derived — never stored — from the
 * persisted card and its sense:
 *
 * 1. `retired`: the sense or its item is retired, so it's no longer reviewed;
 * 2. `no_exercise`: the sense generates no review exercise (none today; possible for new content);
 * 3. `new`: never answered (`reviews = 0`, or no card yet);
 * 4. `due`: answered before, and its next review time has come;
 * 5. `known`: box 4 or 5;
 * 6. `learning`: box 1 to 3.
 */
export type ReviewStatus = "retired" | "no_exercise" | "new" | "due" | "known" | "learning";

export function reviewStatus(
  input: { card: CardState; retired: boolean; hasExercise: boolean },
  now: Date,
): ReviewStatus {
  const { card } = input;
  if (input.retired) return "retired";
  if (!input.hasExercise) return "no_exercise";
  if (card.reviews === 0) return "new";
  if (isDue(card, now)) return "due";
  return card.box >= 4 ? "known" : "learning";
}

/**
 * When a card comes back (specification §10.4), without timezones: due now, or in whole days
 * rounded up — a card due 30 hours from now is "in 2 days". The caller words it.
 */
export type NextReview = { due: true } | { due: false; days: number };

export function nextReview(card: Pick<CardState, "dueAt">, now: Date): NextReview {
  if (isDue(card, now)) return { due: true };
  return { due: false, days: Math.ceil((card.dueAt.getTime() - now.getTime()) / DAY_MS) };
}

/** "Due now", "Next review in 1 day", "Next review in 3 days" — whole days, no timezones. */
export function nextReviewText(next: NextReview) {
  if (next.due) return "Due now";
  return `Next review in ${next.days} ${next.days === 1 ? "day" : "days"}`;
}
