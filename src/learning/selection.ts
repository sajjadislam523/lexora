import { learningReasonText, type LearningReason, type LearningState } from "./state";

/**
 * Practice selection (Phase 7.3): which saved senses a review session takes first, and why. Pure
 * and deterministic; it reads learning states (src/learning/state.ts) and decides nothing about
 * stages, due or evidence itself.
 *
 * Only what Review can take is selectable: a sense that is due and not retired (specification
 * §14: no early reviews; an answer before the due time is refused). Within that pool, three
 * tiers, each sense in exactly one, the first that applies:
 *
 * 1. `missed`: answered before, and the latest answer was wrong. More wrong answers in a row
 *    come first: the evidence is stronger.
 * 2. `due`: answered before, latest answer right, and its review time has come. Learning before
 *    known: a known sense is reinforcement.
 * 3. `new`: not answered on this save yet (never practised, or saved again).
 *
 * Ties keep the order the candidates were given in, which is Review's own order (most overdue
 * first, then new by save time, then sense ID): no score and no randomness.
 */
export type PracticeTier = "missed" | "due" | "new";

/** Why a sense was selected: its learning-state reason, or "Due for review." for tier 2. */
export type PracticeReason =
  Extract<LearningReason, { code: "missed" | "not_practised" | "saved_again" }> | { code: "due" };

/** The sense's tier, or null when Review can't take it now (not due, or retired). */
export function practiceTier(state: LearningState): PracticeTier | null {
  if (state.retired || !state.due) return null;
  if (state.stage === "new") return "new";
  return state.evidence.latest?.outcome === "incorrect" ? "missed" : "due";
}

function reasonFor(tier: PracticeTier, state: LearningState): PracticeReason {
  const reason = state.reason;
  if (tier === "missed" && reason.code === "missed") return reason;
  if (tier === "new" && (reason.code === "not_practised" || reason.code === "saved_again")) {
    return reason;
  }
  return { code: "due" };
}

const TIER_RANK: Record<PracticeTier, number> = { missed: 0, due: 1, new: 2 };

export type Ranked<T> = T & { tier: PracticeTier; reason: PracticeReason };

/**
 * The selectable candidates in practice order, each sense once (its first occurrence), with its
 * tier and reason. `candidates` come in Review's order, which breaks every tie.
 */
export function rankPracticeCandidates<T extends { state: LearningState }>(
  candidates: readonly T[],
): Ranked<T>[] {
  const seen = new Set<string>();
  const selectable = candidates.flatMap((candidate, index) => {
    const tier = practiceTier(candidate.state);
    if (tier === null || seen.has(candidate.state.senseId)) return [];
    seen.add(candidate.state.senseId);
    return [{ candidate, index, tier }];
  });
  const missesInARow = (state: LearningState) =>
    state.evidence.latest?.outcome === "incorrect" ? state.evidence.latest.inARow : 0;
  selectable.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      (a.tier === "missed"
        ? missesInARow(b.candidate.state) - missesInARow(a.candidate.state)
        : 0) ||
      (a.tier === "due"
        ? Number(a.candidate.state.stage === "known") - Number(b.candidate.state.stage === "known")
        : 0) ||
      a.index - b.index,
  );
  return selectable.map(({ candidate, tier }) => ({
    ...candidate,
    tier,
    reason: reasonFor(tier, candidate.state),
  }));
}

/** "Due for review.", "Missed the last 2 times.", "Not practised yet." */
export function practiceReasonText(reason: PracticeReason) {
  return reason.code === "due" ? "Due for review." : learningReasonText(reason);
}
