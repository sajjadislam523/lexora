import "server-only";

import { learningState, type LearningState } from "@/learning/state";
import { db } from "@/server/db/client";
import { learningEvidence } from "@/server/repositories/review-cards";

/**
 * Learning state (Phase 7.1): each saved sense's stage, due time and practice evidence, with the
 * reason in observed facts (src/learning/state.ts). Read from `saved_senses`, `review_cards` and
 * `review_log` in one statement; nothing is stored, scheduled or changed. The user ID comes from
 * the validated session, never from the client. Only saved senses have a learning state.
 */

/** The learner's learning state for these senses (or every saved sense, with `null`) at `now`. */
export async function loadLearningStates(
  userId: string,
  senseIds: readonly string[] | null,
  now: Date,
): Promise<Map<string, LearningState>> {
  const entries = await learningEvidence(db, userId, senseIds);
  return new Map(entries.map((entry) => [entry.senseId, learningState(entry, now)]));
}

/** One sense's learning state at `now`, or null when the learner hasn't saved it. */
export async function loadLearningState(
  userId: string,
  senseId: string,
  now: Date,
): Promise<LearningState | null> {
  return (await loadLearningStates(userId, [senseId], now)).get(senseId) ?? null;
}
