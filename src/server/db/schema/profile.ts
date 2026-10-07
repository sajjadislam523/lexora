import { relations, sql } from "drizzle-orm";
import { check, date, numeric, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Product data about the learner — deliberately separate from the auth tables, so the
 * authentication layer stays replaceable and product data never lives in Better Auth's schema.
 * One row per user, created on first save.
 */
export const focusSkill = pgEnum("focus_skill", ["writing", "speaking", "both"]);

export const learnerProfiles = pgTable(
  "learner_profiles",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** IELTS band the learner is aiming for: 4.0–9.0 in steps of 0.5. */
    targetBand: numeric({ precision: 3, scale: 1 }),
    testDate: date(),
    focusSkill: focusSkill(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "learner_profiles_target_band_range",
      sql`${table.targetBand} is null or (${table.targetBand} between 4.0 and 9.0 and mod(${table.targetBand} * 2, 1) = 0)`,
    ),
  ],
);

export const learnerProfilesRelations = relations(learnerProfiles, ({ one }) => ({
  user: one(users, { fields: [learnerProfiles.userId], references: [users.id] }),
}));
