import { describe, expect, it } from "vitest";

import { DAY_MS, newCard, schedule, type CardState, type Outcome } from "./scheduler";
import { practiceReasonText, practiceTier, rankPracticeCandidates } from "./selection";
import { evidenceFrom, learningState, type LearningState } from "./state";

/**
 * Practice selection (Phase 7.3), with a fixed clock: every state is built from answers run
 * through the real scheduler, so it's one the review loop can produce.
 */
const SAVED = new Date("2026-10-01T09:00:00.000Z");
/** Long after every answer below: everything answered is due again. */
const LATER = new Date(SAVED.getTime() + 200 * DAY_MS);
const C: Outcome = "correct";
const X: Outcome = "incorrect";

function state(
  senseId: string,
  outcomes: Outcome[],
  options: { now?: Date; retired?: boolean; earlier?: Outcome[] } = {},
): LearningState {
  let card: CardState = newCard(SAVED);
  const answers: { outcome: Outcome; reviewedAt: Date; reviewNumber: number }[] = [];
  // Answers from before the sense was removed and saved again: history, not this card.
  for (const [i, outcome] of (options.earlier ?? []).entries()) {
    answers.push({
      outcome,
      reviewedAt: new Date(SAVED.getTime() - (i + 1) * DAY_MS),
      reviewNumber: i + 1,
    });
  }
  for (const outcome of outcomes) {
    const at = new Date(card.dueAt.getTime() + 60_000);
    card = schedule(card, outcome, at);
    answers.push({ outcome, reviewedAt: at, reviewNumber: card.reviews });
  }
  return learningState(
    {
      senseId,
      savedAt: SAVED,
      card,
      retired: options.retired ?? false,
      evidence: evidenceFrom(answers),
    },
    options.now ?? LATER,
  );
}

const rank = (states: LearningState[]) =>
  rankPracticeCandidates(states.map((s) => ({ state: s }))).map((c) => [
    c.state.senseId,
    c.tier,
    c.reason,
  ]);

describe("practiceTier", () => {
  it("puts each kind of sense in one tier, the first that applies", () => {
    // due + learning, latest wrong → missed
    expect(practiceTier(state("a", [C, X]))).toBe("missed");
    // due + learning, latest right → due
    expect(practiceTier(state("b", [C, C]))).toBe("due");
    // due + known → due
    expect(practiceTier(state("c", [C, C, C, C]))).toBe("due");
    // new + due → new
    expect(practiceTier(state("d", []))).toBe("new");
    // saved again: new card, earlier misses → new, not missed
    expect(practiceTier(state("e", [], { earlier: [X, X] }))).toBe("new");
  });

  it("selects nothing Review can't take now: not due, or retired", () => {
    const answered = state("a", [C, X]);
    const notDue = state("a", [C, X], { now: new Date(SAVED.getTime() + 60_000 * 3) });
    expect(answered.due).toBe(true);
    expect(notDue.due).toBe(false);
    expect(practiceTier(notDue)).toBeNull();
    expect(practiceTier(state("k", [C, C, C, C], { now: SAVED }))).toBeNull(); // known, not due
    expect(practiceTier(state("r", [X], { retired: true }))).toBeNull();
    expect(practiceTier(state("n", [], { retired: true }))).toBeNull();
  });
});

describe("rankPracticeCandidates", () => {
  it("orders missed, then other due, then new", () => {
    expect(rank([state("new", []), state("due", [C]), state("missed", [X])])).toEqual([
      ["missed", "missed", { code: "missed", times: 1 }],
      ["due", "due", { code: "due" }],
      ["new", "new", { code: "not_practised" }],
    ]);
  });

  it("puts more misses in a row first", () => {
    const order = rank([state("once", [C, X]), state("thrice", [X, X, X]), state("twice", [X, X])]);
    expect(order.map(([id]) => id)).toEqual(["thrice", "twice", "once"]);
    expect(order[0]![2]).toEqual({ code: "missed", times: 3 });
  });

  it("puts learning before known among due senses", () => {
    const order = rank([state("known", [C, C, C, C]), state("learning", [C, C])]);
    expect(order.map(([id]) => id)).toEqual(["learning", "known"]);
  });

  it("keeps the given order (Review's) for ties", () => {
    const ids = ["n3", "n1", "n2"];
    expect(rank(ids.map((id) => state(id, []))).map(([id]) => id)).toEqual(ids);
    const missed = ["m2", "m1"].map((id) => state(id, [X]));
    expect(rank(missed).map(([id]) => id)).toEqual(["m2", "m1"]);
    expect(rank([...missed].reverse()).map(([id]) => id)).toEqual(["m1", "m2"]);
  });

  it("gives the same result every time", () => {
    const states = [state("a", []), state("b", [X, X]), state("c", [C]), state("d", [X])];
    expect(rank(states)).toEqual(rank(states));
  });

  it("lists each sense once, and leaves out what isn't selectable", () => {
    const due = state("same", [C, X]);
    const order = rank([
      due,
      due,
      state("later", [C], { now: SAVED }),
      state("gone", [X], { retired: true }),
    ]);
    expect(order).toEqual([["same", "missed", { code: "missed", times: 1 }]]);
  });

  it("keeps a saved-again sense's own reason", () => {
    expect(rank([state("again", [], { earlier: [C, X] })])).toEqual([
      ["again", "new", { code: "saved_again" }],
    ]);
  });

  it("is empty for no candidates", () => {
    expect(rankPracticeCandidates([])).toEqual([]);
  });
});

describe("practiceReasonText", () => {
  it("says why in observed facts, reusing the learning state's wording", () => {
    expect(practiceReasonText({ code: "due" })).toBe("Due for review.");
    expect(practiceReasonText({ code: "missed", times: 1 })).toBe("Missed last time.");
    expect(practiceReasonText({ code: "missed", times: 2 })).toBe("Missed the last 2 times.");
    expect(practiceReasonText({ code: "not_practised" })).toBe("Not practised yet.");
    expect(practiceReasonText({ code: "saved_again" })).toBe(
      "Saved again, so its reviews start over.",
    );
  });
});
