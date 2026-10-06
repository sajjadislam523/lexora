import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { learnerProfiles } from "@/server/db/schema";

export type LearnerProfileValues = {
  targetBand: string | null;
  testDate: string | null;
  focusSkill: (typeof learnerProfiles.$inferInsert)["focusSkill"];
};

/**
 * Learner profile data access. Every function takes the user id explicitly; callers must pass
 * the id from the validated session — never an id supplied by the client.
 */
export async function getLearnerProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, userId))
    .limit(1);
  return profile ?? null;
}

export async function upsertLearnerProfile(userId: string, input: LearnerProfileValues) {
  const values = {
    targetBand: input.targetBand,
    testDate: input.testDate,
    focusSkill: input.focusSkill,
  };
  const [profile] = await db
    .insert(learnerProfiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: learnerProfiles.userId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return profile!;
}
