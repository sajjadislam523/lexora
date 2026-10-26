import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Box, CardState, Outcome } from "@/learning/scheduler";
import { newCard } from "@/learning/scheduler";
import { NO_EVIDENCE, type PracticeEvidence } from "@/learning/state";
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

// ── Review selection (specification §14) ─────────────────────────────────────────────────────

export type QueueEntry = ReviewState & { senseId: string };

/**
 * The learner's saved senses that can be reviewed (published sense and item), in review order.
 * `due`: what is due at `now` — reviewed cards first, most overdue first, then new ones, oldest
 * save first. `upcoming`: what isn't due yet, soonest first. Ties by sense ID; no randomness.
 * Saves without a card are included, as new. One statement; `limit` leaves room for senses
 * that turn out to have no exercise.
 */
export async function reviewQueue(
  userId: string,
  now: Date,
  options: { when: "due" | "upcoming"; limit: number },
): Promise<QueueEntry[]> {
  const { reviewed, dueAt, due } = bankTerms(now);
  const order =
    options.when === "due"
      ? [
          sql`case when ${reviewed} then 0 else 1 end`,
          sql`case when ${reviewed} then ${dueAt} else ${savedSenses.savedAt} end`,
        ]
      : [dueAt];
  const rows = await db
    .select({ ...cardColumns, senseId: savedSenses.senseId })
    .from(savedSenses)
    .innerJoin(senses, eq(senses.id, savedSenses.senseId))
    .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
    .leftJoin(
      reviewCards,
      and(eq(reviewCards.userId, savedSenses.userId), eq(reviewCards.senseId, savedSenses.senseId)),
    )
    .where(
      and(
        eq(savedSenses.userId, userId),
        eq(senses.status, "published"),
        eq(languageItems.status, "published"),
        options.when === "due" ? due : sql`not ${due}`,
      ),
    )
    .orderBy(...order, asc(savedSenses.senseId))
    .limit(options.limit);
  return rows.map((row) => ({ ...toState(row), senseId: row.senseId }));
}

// ── Personal mistake evidence (specification §16, D14) ───────────────────────────────────────

/** How far back a wrong answer counts: 30 days of 24 hours, before `now` (exclusive). */
export const EVIDENCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** How many times the same wrong answer must recur in the window. */
export const EVIDENCE_THRESHOLD = 2;

export type RecurringMistake = {
  senseId: string;
  /** The authored mistake the answers matched; null for a repeated unrecognised typed answer. */
  mistakeId: string | null;
  /** The repeated typed answer (normalised); null when every occurrence was a choice. */
  answer: string | null;
  /** The answer Lexora was looking for, as last shown. */
  expected: string;
  times: number;
  lastAt: Date;
};

/**
 * The learner's recurring mistakes on these senses (or on any, with `null`) at `now`: the same wrong response (the
 * authored mistake it matched, otherwise the exact normalised typed answer) on the same sense
 * at least twice in the 30 days before `now`, unless resolved — the sense's two latest answers
 * both correct and both after the latest occurrence. Read from `review_log` only, so it counts
 * only answers that were recorded (never a refused, duplicate or rate-limited request), and it
 * outlives a removed save, as the log does. One statement.
 */
export async function recurringMistakes(
  executor: Executor,
  userId: string,
  senseIds: readonly string[] | null,
  now: Date,
): Promise<RecurringMistake[]> {
  if (senseIds?.length === 0) return [];
  const until = now.toISOString();
  const since = new Date(now.getTime() - EVIDENCE_WINDOW_MS).toISOString();
  const rows = await executor.execute<{
    sense_id: string;
    mistake_id: string | null;
    answer: string | null;
    expected: string;
    times: number;
    last_at: string | Date;
  }>(sql`
    with wrong as (
      select ${reviewLog.senseId} as sense_id,
             coalesce(${reviewLog.mistakeId}, 'answer:' || ${reviewLog.answer}) as response,
             ${reviewLog.mistakeId} as mistake_id, ${reviewLog.answer} as answer,
             ${reviewLog.expected} as expected, ${reviewLog.reviewedAt} as reviewed_at
      from ${reviewLog}
      where ${reviewLog.userId} = ${userId}
        and ${senseIds ? inArray(reviewLog.senseId, [...new Set(senseIds)]) : sql`true`}
        and ${reviewLog.outcome} = 'incorrect'
        and (${reviewLog.mistakeId} is not null or ${reviewLog.answer} is not null)
        and ${reviewLog.reviewedAt} > ${since}::timestamptz
        and ${reviewLog.reviewedAt} <= ${until}::timestamptz
    ), recurring as (
      select sense_id, response, count(*)::int as times, max(reviewed_at) as last_at,
             (array_agg(mistake_id order by reviewed_at desc))[1] as mistake_id,
             (array_agg(answer order by reviewed_at desc) filter (where answer is not null))[1] as answer,
             (array_agg(expected order by reviewed_at desc))[1] as expected
      from wrong
      group by sense_id, response
      having count(*) >= ${EVIDENCE_THRESHOLD}
    )
    select sense_id, mistake_id, answer, expected, times, last_at
    from recurring r
    where (
      select count(*) from (
        select l.${sql.identifier("outcome")} as outcome, l.${sql.identifier("reviewed_at")} as reviewed_at
        from ${reviewLog} l
        where l.${sql.identifier("user_id")} = ${userId}
          and l.${sql.identifier("sense_id")} = r.sense_id
          and l.${sql.identifier("reviewed_at")} <= ${until}::timestamptz
        order by l.${sql.identifier("reviewed_at")} desc, l.${sql.identifier("review_number")} desc
        limit 2
      ) latest
      where latest.outcome = 'correct' and latest.reviewed_at > r.last_at
    ) < 2
    order by last_at desc, sense_id, response
  `);
  return rows.map((row) => ({
    senseId: row.sense_id,
    mistakeId: row.mistake_id,
    answer: row.answer,
    expected: row.expected,
    times: Number(row.times),
    lastAt: new Date(row.last_at),
  }));
}

// ── Learning state (Phase 7.1) ───────────────────────────────────────────────────────────────

export type LearningEvidenceEntry = ReviewState & { senseId: string; evidence: PracticeEvidence };

/**
 * The learner's saved senses among `senseIds` (or all of them, with `null`), each with its review
 * state and the evidence in its recorded answers (`evidenceFrom` in src/learning/state.ts): every
 * answer on the sense in `review_log`, including those from before it was saved again. Senses
 * the learner hasn't saved are left out. Retired senses are included. Counted and ranked in SQL
 * (no answer rows are returned), ordered by sense ID. One statement, whatever the number of
 * senses.
 */
export async function learningEvidence(
  executor: Executor,
  userId: string,
  senseIds: readonly string[] | null,
): Promise<LearningEvidenceEntry[]> {
  if (senseIds?.length === 0) return [];
  const rows = await executor.execute<{
    sense_id: string;
    saved_at: string | Date;
    card_id: string | null;
    box: number | null;
    due_at: string | Date | null;
    reviews: number | null;
    lapses: number | null;
    last_reviewed_at: string | Date | null;
    sense_status: string;
    item_status: string;
    attempts: number | null;
    correct: number | null;
    last_at: string | Date | null;
    latest_outcome: Outcome | null;
    in_a_row: number | null;
  }>(sql`
    with saved as (
      select ${savedSenses.senseId} as sense_id, ${savedSenses.savedAt} as saved_at
      from ${savedSenses}
      where ${savedSenses.userId} = ${userId}
        and ${senseIds ? inArray(savedSenses.senseId, [...new Set(senseIds)]) : sql`true`}
    ), answers as (
      select l.${sql.identifier("sense_id")} as sense_id, l.${sql.identifier("outcome")} as outcome,
             l.${sql.identifier("reviewed_at")} as reviewed_at,
             row_number() over latest_first as recency,
             first_value(l.${sql.identifier("outcome")}) over latest_first as latest_outcome
      from ${reviewLog} l
      where l.${sql.identifier("user_id")} = ${userId}
        and l.${sql.identifier("sense_id")} in (select sense_id from saved)
      window latest_first as (
        partition by l.${sql.identifier("sense_id")}
        order by l.${sql.identifier("reviewed_at")} desc, l.${sql.identifier("review_number")} desc
      )
    ), evidence as (
      select sense_id,
             count(*)::int as attempts,
             count(*) filter (where outcome = 'correct')::int as correct,
             max(reviewed_at) as last_at,
             min(latest_outcome::text) as latest_outcome,
             -- the answers before the latest one with a different outcome, or all of them
             coalesce(min(recency) filter (where outcome <> latest_outcome) - 1, count(*))::int as in_a_row
      from answers
      group by sense_id
    )
    select saved.sense_id, saved.saved_at,
           c.${sql.identifier("id")} as card_id, c.${sql.identifier("box")} as box,
           c.${sql.identifier("due_at")} as due_at, c.${sql.identifier("reviews")} as reviews,
           c.${sql.identifier("lapses")} as lapses,
           c.${sql.identifier("last_reviewed_at")} as last_reviewed_at,
           s.${sql.identifier("status")} as sense_status, i.${sql.identifier("status")} as item_status,
           e.attempts, e.correct, e.last_at, e.latest_outcome, e.in_a_row
    from saved
    join ${senses} s on s.${sql.identifier("id")} = saved.sense_id
    join ${languageItems} i on i.${sql.identifier("id")} = s.${sql.identifier("item_id")}
    left join ${reviewCards} c
      on c.${sql.identifier("user_id")} = ${userId} and c.${sql.identifier("sense_id")} = saved.sense_id
    left join evidence e on e.sense_id = saved.sense_id
    order by saved.sense_id
  `);
  const date = (value: string | Date | null) => (value === null ? null : new Date(value));
  return rows.map((row) => {
    const attempts = Number(row.attempts ?? 0);
    const correct = Number(row.correct ?? 0);
    return {
      ...toState({
        savedAt: date(row.saved_at)!,
        cardId: row.card_id,
        box: row.box,
        dueAt: date(row.due_at),
        reviews: row.reviews,
        lapses: row.lapses,
        lastReviewedAt: date(row.last_reviewed_at),
        senseStatus: row.sense_status,
        itemStatus: row.item_status,
      }),
      senseId: row.sense_id,
      evidence:
        attempts === 0 || row.latest_outcome === null
          ? NO_EVIDENCE
          : {
              attempts,
              correct,
              incorrect: attempts - correct,
              lastPractisedAt: date(row.last_at),
              latest: { outcome: row.latest_outcome, inARow: Number(row.in_a_row) },
            },
    };
  });
}

// ── Home (specification §18) ─────────────────────────────────────────────────────────────────

export type RecentEntry = QueueEntry & {
  slug: string;
  headword: string;
  kind: (typeof languageItems.$inferSelect)["kind"];
  senseLabel: string | null;
  bestWhen: string;
};

/** The learner's latest saves of published senses, newest first (ties by sense ID). One statement. */
export async function recentlySaved(userId: string, limit: number): Promise<RecentEntry[]> {
  const rows = await db
    .select({
      ...cardColumns,
      senseId: savedSenses.senseId,
      slug: languageItems.slug,
      headword: languageItems.headword,
      kind: languageItems.kind,
      senseLabel: senses.label,
      bestWhen: senses.bestWhen,
    })
    .from(savedSenses)
    .innerJoin(senses, eq(senses.id, savedSenses.senseId))
    .innerJoin(languageItems, eq(languageItems.id, senses.itemId))
    .leftJoin(
      reviewCards,
      and(eq(reviewCards.userId, savedSenses.userId), eq(reviewCards.senseId, savedSenses.senseId)),
    )
    .where(
      and(
        eq(savedSenses.userId, userId),
        eq(senses.status, "published"),
        eq(languageItems.status, "published"),
      ),
    )
    .orderBy(desc(savedSenses.savedAt), asc(savedSenses.senseId))
    .limit(limit);
  return rows.map((row) => ({
    ...toState(row),
    senseId: row.senseId,
    slug: row.slug,
    headword: row.headword,
    kind: row.kind,
    senseLabel: row.senseLabel,
    bestWhen: row.bestWhen,
  }));
}
