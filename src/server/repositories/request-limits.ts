import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { requestLimits } from "@/server/db/schema";

export type LimitedAction = (typeof requestLimits.$inferInsert)["action"];

/**
 * Counts one request by this learner for this action in the window starting at `windowStart`
 * and returns the window's total, including this request. One atomic upsert: a new window
 * replaces the previous one, so the table holds at most one row per learner per action.
 * Concurrent requests serialise on the row, so every request is counted exactly once.
 */
export async function countRequest(
  userId: string,
  action: LimitedAction,
  windowStart: Date,
): Promise<number> {
  const [row] = await db
    .insert(requestLimits)
    .values({ userId, action, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [requestLimits.userId, requestLimits.action],
      set: {
        count: sql`case when "request_limits"."window_start" = excluded."window_start" then "request_limits"."count" + 1 else 1 end`,
        windowStart: sql`excluded."window_start"`,
      },
    })
    .returning({ count: requestLimits.count });
  return row!.count;
}
