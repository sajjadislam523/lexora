import "server-only";

import { rankPracticeCandidates, type Ranked } from "@/learning/selection";
import type { LearningState } from "@/learning/state";
import { loadLearningStates } from "@/server/learning/state";
import { reviewQueue, type QueueEntry } from "@/server/repositories/review-cards";

/**
 * Practice selection (Phase 7.3): the learner's saved senses Review can take now, in practice
 * order with a reason each (src/learning/selection.ts). The pool is Review's own due queue, so
 * selection can never call something due that Review doesn't; its learning states come from
 * `loadLearningStates` in one batch. Two statements; nothing is written. The user ID comes from
 * the validated session, never from the client.
 */

/**
 * The most due senses considered at once: Review's order decides which, so a backlog beyond
 * this is reached as the senses ahead of it are answered.
 */
export const PRACTICE_POOL_LIMIT = 200;

export type PracticeCandidate = Ranked<{ entry: QueueEntry; state: LearningState }>;

/** Up to `limit` candidates at `now`, best first; empty when nothing is due. */
export async function selectPracticeCandidates(
  userId: string,
  now: Date,
  limit: number,
): Promise<PracticeCandidate[]> {
  const size = Math.max(0, Math.min(Math.floor(limit), PRACTICE_POOL_LIMIT));
  if (size === 0) return [];
  const pool = await reviewQueue(userId, now, { when: "due", limit: PRACTICE_POOL_LIMIT });
  if (pool.length === 0) return [];
  const states = await loadLearningStates(
    userId,
    pool.map((entry) => entry.senseId),
    now,
  );
  // A save removed between the two reads has no state: leave it out.
  const candidates = pool.flatMap((entry) => {
    const state = states.get(entry.senseId);
    return state ? [{ entry, state }] : [];
  });
  return rankPracticeCandidates(candidates).slice(0, size);
}
