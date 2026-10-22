import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { Box, CardState } from "@/learning/scheduler";
import { newCard } from "@/learning/scheduler";
import { db } from "@/server/db/client";
import { languageItems, reviewCards, reviewLog, savedSenses, senses } from "@/server/db/schema";

/**
 * Review cards and the review log (specification §9). Every function takes the user ID
 * explicitly; callers pass the ID from the validated session, never one from the client.
 */

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** The database, or a transaction the caller has open. */
export type Executor = typeof db | Transaction;

/**
 * Creates the card for a saved sense, unless it has one: box 0, due when the sense was saved.
 * Does nothing when the sense isn't saved by this learner. Safe to repeat and to race.
 */
export async function ensureCard(executor: Executor, userId: string, senseId: string) {
  await executor.execute(sql`
    insert into ${reviewCards} (${sql.identifier("user_id")}, ${sql.identifier("sense_id")}, ${sql.identifier("box")}, ${sql.identifier("due_at")})
    select ${savedSenses.userId}, ${savedSenses.senseId}, 0, ${savedSenses.savedAt}
    from ${savedSenses}
    where ${savedSenses.userId} = ${userId} and ${savedSenses.senseId} = ${senseId}
    on conflict (${sql.identifier("user_id")}, ${sql.identifier("sense_id")}) do nothing
  `);
}

export type ReviewState = {
  savedAt: Date;
  /** The card's id, or null for a save that has no card yet (it reads as new). */
  cardId: string | null;
  card: CardState;
  /** The sense or its item is no longer published. */
  retired: boolean;
};

const cardColumns = {
  savedAt: savedSenses.savedAt,
  cardId: reviewCards.id,
  box: reviewCards.box,
  dueAt: reviewCards.dueAt,
  reviews: reviewCards.reviews,
  lapses: reviewCards.lapses,
  lastReviewedAt: reviewCards.lastReviewedAt,
  senseStatus: senses.status,
  itemStatus: languageItems.status,
};

type CardRow = {
  savedAt: Date;
  cardId: string | null;
  box: number | null;
  dueAt: Date | null;
  reviews: number | null;
  lapses: number | null;
  lastReviewedAt: Date | null;
  senseStatus: string;
  itemStatus: string;
};

function toState(row: CardRow): ReviewState {
  const card: CardState =
    row.cardId === null
      ? newCard(row.savedAt)
      : {
          box: row.box as Box,
          dueAt: row.dueAt!,
          reviews: row.reviews!,
          lapses: row.lapses!,
          lastReviewedAt: row.lastReviewedAt,
        };
  return {
    savedAt: row.savedAt,
    cardId: row.cardId,
    card,
    retired: row.senseStatus !== "published" || row.itemStatus !== "published",
  };
}

/**
 * A saved sense's review state, or null when the learner hasn't saved it. A save without a card
 * (made before Phase 5) reads as new, due since it was saved.
 */
export async function reviewStateOf(userId: string, senseId: string): Promise<ReviewState | null> {
  const [row] = await db
    .select(cardColumns)
    .from(savedSenses)
    .innerJoin(senses, eq(senses.id, savedSenses.senseId))
    .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
    .leftJoin(
      reviewCards,
      and(eq(reviewCards.userId, savedSenses.userId), eq(reviewCards.senseId, savedSenses.senseId)),
    )
    .where(and(eq(savedSenses.userId, userId), eq(savedSenses.senseId, senseId)))
    .limit(1);
  return row ? toState(row) : null;
}

/** The learner's card for a saved sense, locked for update until the transaction ends. */
export async function lockCard(
  tx: Transaction,
  userId: string,
  senseId: string,
): Promise<(ReviewState & { cardId: string }) | null> {
  const [row] = await tx
    .select(cardColumns)
    .from(reviewCards)
    .innerJoin(
      savedSenses,
      and(eq(savedSenses.userId, reviewCards.userId), eq(savedSenses.senseId, reviewCards.senseId)),
    )
    .innerJoin(senses, eq(senses.id, reviewCards.senseId))
    .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
    .where(and(eq(reviewCards.userId, userId), eq(reviewCards.senseId, senseId)))
    .for("update", { of: reviewCards })
    .limit(1);
  if (!row) return null;
  return { ...toState(row), cardId: row.cardId! };
}

/** Writes the card's new scheduling state. */
export async function updateCard(tx: Transaction, cardId: string, next: CardState) {
  await tx
    .update(reviewCards)
    .set({
      box: next.box,
      dueAt: next.dueAt,
      reviews: next.reviews,
      lapses: next.lapses,
      lastReviewedAt: next.lastReviewedAt,
    })
    .where(eq(reviewCards.id, cardId));
}

export type AnswerRow = typeof reviewLog.$inferSelect;
export type NewAnswerRow = typeof reviewLog.$inferInsert;

/** The recorded answer with this review number on this card, if there is one. */
export async function findAnswer(
  executor: Executor,
  cardId: string,
  reviewNumber: number,
): Promise<AnswerRow | null> {
  const [row] = await executor
    .select()
    .from(reviewLog)
    .where(and(eq(reviewLog.cardId, cardId), eq(reviewLog.reviewNumber, reviewNumber)))
    .limit(1);
  return row ?? null;
}

/** Appends one answer to the log. `(card_id, review_number)` is unique: an answer is once-only. */
export async function insertAnswer(tx: Transaction, row: NewAnswerRow): Promise<AnswerRow> {
  const [inserted] = await tx.insert(reviewLog).values(row).returning();
  return inserted!;
}
