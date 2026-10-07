import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { senses } from "./language";

/**
 * Language a learner has saved — personal data, kept apart from the global language tables.
 * Learners save a **sense** (`significant.notable`), not a whole item: the meaning they need.
 * Sense IDs never change and senses are never deleted (only retired), so a save survives every
 * content re-import; `restrict` makes the database refuse a deletion that would break one.
 * The Language Bank screen that lists these arrives in Phase 5.
 */
export const savedSenses = pgTable(
  "saved_senses",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "restrict" }),
    savedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.senseId] }),
    index("saved_senses_user_saved_at_idx").on(table.userId, table.savedAt),
  ],
);

export const savedSensesRelations = relations(savedSenses, ({ one }) => ({
  user: one(users, { fields: [savedSenses.userId], references: [users.id] }),
  sense: one(senses, { fields: [savedSenses.senseId], references: [senses.id] }),
}));
