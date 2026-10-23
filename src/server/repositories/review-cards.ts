import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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

// ── The language bank (specification §17) ───────────────────────────────────────────────────

const replacementSense = alias(senses, "replacement_sense");
const replacementItem = alias(languageItems, "replacement_item");

/** The bank's scheduling predicates, shared by the counts and the row order. */
function bankTerms(now: Date) {
  const retired = sql`(${senses.status} <> 'published' or ${languageItems.status} <> 'published')`;
  const reviewed = sql`coalesce(${reviewCards.reviews}, 0) > 0`;
  // A save without a card reads as new, due since it was saved.
  const dueAt = sql`coalesce(${reviewCards.dueAt}, ${savedSenses.savedAt})`;
  // A raw Date isn't serialised inside a hand-written fragment; pass it as an ISO timestamp.
  const due = sql`${dueAt} <= ${now.toISOString()}::timestamptz`;
  return { retired, reviewed, dueAt, due };
}

export type BankCounts = {
  total: number;
  due: number;
  new: number;
  learning: number;
  known: number;
  retired: number;
};

/** How many saved senses the learner has in each scheduling state. One statement. */
export async function bankCounts(userId: string, now: Date): Promise<BankCounts> {
  const { retired, reviewed, due } = bankTerms(now);
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      due: sql<number>`count(*) filter (where not ${retired} and ${reviewed} and ${due})::int`,
      new: sql<number>`count(*) filter (where not ${retired} and not ${reviewed})::int`,
      learning: sql<number>`count(*) filter (where not ${retired} and ${reviewed} and not ${due} and ${reviewCards.box} between 1 and 3)::int`,
      known: sql<number>`count(*) filter (where not ${retired} and ${reviewed} and not ${due} and ${reviewCards.box} >= 4)::int`,
      retired: sql<number>`count(*) filter (where ${retired})::int`,
    })
    .from(savedSenses)
    .innerJoin(senses, eq(senses.id, savedSenses.senseId))
    .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
    .leftJoin(
      reviewCards,
      and(eq(reviewCards.userId, savedSenses.userId), eq(reviewCards.senseId, savedSenses.senseId)),
    )
    .where(eq(savedSenses.userId, userId));
  return row!;
}

export type BankEntry = ReviewState & {
  senseId: string;
  slug: string;
  headword: string;
  kind: (typeof languageItems.$inferSelect)["kind"];
  senseLabel: string | null;
  definition: string;
  /** The item is published, so its language page exists (even if this sense is retired). */
  itemPublished: boolean;
  /** For a retired sense whose replacement is published. */
  replacement: {
    senseId: string;
    slug: string;
    headword: string;
    senseLabel: string | null;
  } | null;
};

/**
 * One page of the learner's saved senses in bank order (specification §14, §17): reviewed cards
 * that are due (oldest due first), then new ones (oldest save first), then the rest by when they
 * come back, then retired ones; ties by sense ID. Saves without a card are included, as new.
 * One statement.
 */
export async function listBank(
  userId: string,
  now: Date,
  page: { limit: number; offset: number },
): Promise<BankEntry[]> {
  const { retired, reviewed, dueAt, due } = bankTerms(now);
  const rank = sql`case when ${retired} then 3 when not ${reviewed} then 1 when ${due} then 0 else 2 end`;
  const rows = await db
    .select({
      ...cardColumns,
      senseId: savedSenses.senseId,
      slug: languageItems.slug,
      headword: languageItems.headword,
      kind: languageItems.kind,
      senseLabel: senses.label,
      definition: senses.definition,
      replacementId: replacementSense.id,
      replacementSlug: replacementItem.slug,
      replacementHeadword: replacementItem.headword,
      replacementLabel: replacementSense.label,
    })
    .from(savedSenses)
    .innerJoin(senses, eq(senses.id, savedSenses.senseId))
    .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
    .leftJoin(
      reviewCards,
      and(eq(reviewCards.userId, savedSenses.userId), eq(reviewCards.senseId, savedSenses.senseId)),
    )
    .leftJoin(
      replacementSense,
      and(eq(replacementSense.id, senses.replacedBy), eq(replacementSense.status, "published")),
    )
    .leftJoin(
      replacementItem,
      and(eq(replacementItem.id, replacementSense.itemId), eq(replacementItem.status, "published")),
    )
    .where(eq(savedSenses.userId, userId))
    .orderBy(
      rank,
      sql`case when ${rank} in (1, 3) then ${savedSenses.savedAt} else ${dueAt} end`,
      asc(savedSenses.senseId),
    )
    .limit(page.limit)
    .offset(page.offset);

  return rows.map((row) => ({
    ...toState(row),
    senseId: row.senseId,
    slug: row.slug,
    headword: row.headword,
    kind: row.kind,
    senseLabel: row.senseLabel,
    definition: row.definition,
    itemPublished: row.itemStatus === "published",
    replacement:
      row.replacementId && row.replacementSlug && row.replacementHeadword
        ? {
            senseId: row.replacementId,
            slug: row.replacementSlug,
            headword: row.replacementHeadword,
            senseLabel: row.replacementLabel,
          }
        : null,
  }));
}
