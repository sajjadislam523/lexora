import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { savedSenses } from "./bank";
import { senses } from "./language";

/**
 * Review state for saved language (Phase 5, specification §9). `saved_senses` stays the record of
 * what a learner owns; a review card is its scheduling state and lives only as long as the save
 * (composite FK, cascade). The review log is the learner's history: it outlives the card, so it
 * references the user and the sense directly, and keeps the card's id without a foreign key.
 * A save made before Phase 5 has no card: reads treat it as new, due since it was saved, and the
 * first answer creates the card. Nothing is backfilled.
 */

/** One card per learner and saved sense: the Leitner state (src/learning/scheduler.ts). */
export const reviewCards = pgTable(
  "review_cards",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(),
    senseId: text().notNull(),
    /** 0 = new, never answered; 1–5 = the Leitner box. */
    box: smallint().notNull().default(0),
    dueAt: timestamp({ withTimezone: true }).notNull(),
    /** Answers recorded on this card: the next answer's review number is `reviews + 1`. */
    reviews: integer().notNull().default(0),
    /** Wrong answers recorded on this card. */
    lapses: integer().notNull().default(0),
    lastReviewedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("review_cards_user_sense_key").on(table.userId, table.senseId),
    foreignKey({
      name: "review_cards_saved_sense_fk",
      columns: [table.userId, table.senseId],
      foreignColumns: [savedSenses.userId, savedSenses.senseId],
    }).onDelete("cascade"),
    index("review_cards_user_due_idx").on(table.userId, table.dueAt),
    check("review_cards_box_range", sql`${table.box} between 0 and 5`),
    check("review_cards_counts", sql`${table.reviews} >= 0 and ${table.lapses} >= 0`),
  ],
);

export const reviewExerciseType = pgEnum("review_exercise_type", [
  "term",
  "preposition",
  "mistake",
]);
export const reviewOutcome = pgEnum("review_outcome", ["correct", "incorrect"]);
export const answerMatch = pgEnum("answer_match", [
  "expected",
  "form",
  "accepted",
  "mistake",
  "unrecognised",
]);

/** One immutable row per recorded answer. `(card_id, review_number)` makes answers once-only. */
export const reviewLog = pgTable(
  "review_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The card the answer belonged to. No FK: the history outlives a removed save. */
    cardId: uuid().notNull(),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "restrict" }),
    /** 1-based: the card's `reviews` after this answer. */
    reviewNumber: integer().notNull(),
    /** The stable exercise id (`term:<example id>` …). No FK: content can change. */
    exerciseId: text().notNull(),
    exerciseType: reviewExerciseType().notNull(),
    outcome: reviewOutcome().notNull(),
    answerMatch: answerMatch().notNull(),
    /** The learner's normalised typed answer; null for a choice. */
    answer: text(),
    /** The preferred answer shown in feedback. */
    expected: text().notNull(),
    /** The authored mistake the answer matched, if any. No FK: content can change. */
    mistakeId: text(),
    boxBefore: smallint().notNull(),
    boxAfter: smallint().notNull(),
    dueAfter: timestamp({ withTimezone: true }).notNull(),
    reviewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("review_log_card_review_key").on(table.cardId, table.reviewNumber),
    index("review_log_user_reviewed_idx").on(table.userId, table.reviewedAt.desc()),
    index("review_log_user_sense_reviewed_idx").on(
      table.userId,
      table.senseId,
      table.reviewedAt.desc(),
    ),
    check("review_log_review_number", sql`${table.reviewNumber} >= 1`),
    check(
      "review_log_boxes",
      sql`${table.boxBefore} between 0 and 5 and ${table.boxAfter} between 1 and 5`,
    ),
    check(
      "review_log_answer_length",
      sql`${table.answer} is null or char_length(${table.answer}) <= 80`,
    ),
  ],
);
