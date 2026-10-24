import { integer, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Per-user limits on state-changing requests (Phase 5 D17, specification §9.3 and §21). One row
 * per learner per action, holding the current one-minute window and how many requests it has
 * counted, so the table never grows beyond users × actions and needs no clean-up. Anonymous
 * public search is limited at the edge by Vercel Firewall, not here.
 */
export const limitedAction = pgEnum("limited_action", [
  // Saving and removing a sense (PUT / DELETE /api/bank/saved/[senseId]).
  "bank_write",
  // Review answers: the contract for the Phase 5 Step 5 endpoint, which doesn't exist yet.
  "review_answer",
]);

export const requestLimits = pgTable(
  "request_limits",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: limitedAction().notNull(),
    /** Start of the minute this row is counting. */
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.action] })],
);
