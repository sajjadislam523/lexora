import { randomUUID } from "node:crypto";

import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AnswerSubmission } from "@/server/learning/review";

/**
 * Review cards and answers against PostgreSQL (Phase 5 Step 1; specification §9.4, §15): a save
 * becomes a card, older saves without one read as new, answers are recorded exactly once, and
 * removing a save or an account leaves nothing behind but the learner's own history. Throwaway
 * rows with unique IDs, removed afterwards. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!hasDatabase)("review cards and answers (PostgreSQL)", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    saved: typeof import("@/server/repositories/saved-senses");
    cards: typeof import("@/server/repositories/review-cards");
    review: typeof import("@/server/learning/review");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-item-${run}`;
  const sense = (key: string) => `${itemId}.${key}`;
  const [alice, bob, carol] = ["a", "b", "c"].map((key) => `it-review-${key}-${run}`) as [
    string,
    string,
    string,
  ];

  const submission = (overrides: Partial<AnswerSubmission> = {}): AnswerSubmission => ({
    expectedReviews: 0,
    exerciseId: `term:${sense("main")}:ex1`,
    exerciseType: "term",
    outcome: "correct",
    answerMatch: "expected",
    answer: "significant",
    expected: "significant",
    mistakeId: null,
    ...overrides,
  });
  /** Comfortably after the save, so a new card is due. */
  const later = (days = 0) => new Date(Date.now() + 60_000 + days * DAY);

  const logCount = async (where: { userId?: string; senseId?: string; cardId?: string }) => {
    const { reviewLog } = mod.schema;
    const conditions = [
      where.userId && eq(reviewLog.userId, where.userId),
      where.senseId && eq(reviewLog.senseId, where.senseId),
      where.cardId && eq(reviewLog.cardId, where.cardId),
    ].filter((c) => c !== undefined && c !== "");
    const [row] = await mod.db
      .select({ n: count() })
      .from(reviewLog)
      .where(and(...(conditions as never[])));
    return row!.n;
  };
  const cardCount = async (userId: string, senseId?: string) => {
    const { reviewCards } = mod.schema;
    const [row] = await mod.db
      .select({ n: count() })
      .from(reviewCards)
      .where(
        senseId
          ? and(eq(reviewCards.userId, userId), eq(reviewCards.senseId, senseId))
          : eq(reviewCards.userId, userId),
      );
    return row!.n;
  };

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      saved: await import("@/server/repositories/saved-senses"),
      cards: await import("@/server/repositories/review-cards"),
      review: await import("@/server/learning/review"),
    };
    const { db, schema } = mod;
    await db
      .insert(schema.users)
      .values(
        [alice, bob, carol].map((id) => ({ id, name: "Reviewer", email: `${id}@lexora.test` })),
      );
    await db.insert(schema.contentSources).values({
      id: sourceId,
      name: "Integration test",
      kind: "editorial",
      licence: "LicenseRef-Test",
      permittedUses: ["definitions"],
    });
    await db.insert(schema.languageItems).values({
      id: itemId,
      slug: itemId,
      kind: "word",
      headword: itemId,
      normalized: itemId,
      status: "published",
      sourceId,
      authoredBy: "test",
    });
    const base = {
      itemId,
      partOfSpeech: "adjective" as const,
      definition: "Test definition.",
      cefr: "B2" as const,
      registers: ["neutral" as const],
      skills: ["writing" as const],
      ieltsRelevance: "core" as const,
      ieltsTasks: ["writing-2" as const],
      bestWhen: "Testing.",
    };
    await db.insert(schema.senses).values([
      { ...base, id: sense("main"), position: 0 },
      { ...base, id: sense("old"), position: 1 },
      { ...base, id: sense("other"), position: 2 },
      { ...base, id: sense("race"), position: 3 },
      { ...base, id: sense("race2"), position: 4 },
      { ...base, id: sense("retired"), position: 5, status: "retired" },
    ]);
  });

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    // Users first: their saves, cards and review log go with them (cascade).
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob, carol]));
    await db.delete(schema.senses).where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.languageItems).where(eq(schema.languageItems.id, itemId));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
  });

  describe("saving", () => {
    it("creates one card per save: box 0, due when saved, however often it's saved", async () => {
      expect(await mod.saved.saveSense(alice, sense("main"))).toBe("saved");
      const first = await mod.cards.reviewStateOf(alice, sense("main"));
      expect(first?.cardId).not.toBeNull();
      expect(first?.card).toEqual({
        box: 0,
        dueAt: first!.savedAt,
        reviews: 0,
        lapses: 0,
        lastReviewedAt: null,
      });

      expect(await mod.saved.saveSense(alice, sense("main"))).toBe("saved");
      expect(await cardCount(alice, sense("main"))).toBe(1);
      expect((await mod.cards.reviewStateOf(alice, sense("main")))?.cardId).toBe(first!.cardId);
    });

    it("refuses to save an unpublished sense, and creates no card for it", async () => {
      expect(await mod.saved.saveSense(alice, sense("retired"))).toBe("not_found");
      expect(await cardCount(alice, sense("retired"))).toBe(0);
    });

    it("reads nothing for a sense the learner hasn't saved", async () => {
      expect(await mod.cards.reviewStateOf(bob, sense("main"))).toBeNull();
    });
  });

  describe("saves made before Phase 5 (no backfill)", () => {
    it("read as new, due since saved, and get their card with the first answer", async () => {
      const { db, schema } = mod;
      // A save as Phase 3 wrote it: no review card.
      await db.insert(schema.savedSenses).values({ userId: alice, senseId: sense("old") });
      const before = await mod.cards.reviewStateOf(alice, sense("old"));
      expect(before?.cardId).toBeNull();
      expect(before?.card).toEqual({
        box: 0,
        dueAt: before!.savedAt,
        reviews: 0,
        lapses: 0,
        lastReviewedAt: null,
      });
      expect(await cardCount(alice, sense("old"))).toBe(0);

      const now = later();
      const result = await mod.review.recordAnswer(
        alice,
        sense("old"),
        submission({ exerciseId: "term:old:ex1" }),
        now,
      );
      expect(result.status).toBe("recorded");
      const after = await mod.cards.reviewStateOf(alice, sense("old"));
      expect(after?.cardId).not.toBeNull();
      expect(after?.card).toEqual({
        box: 1,
        dueAt: new Date(now.getTime() + DAY),
        reviews: 1,
        lapses: 0,
        lastReviewedAt: now,
      });
    });
  });

  describe("recording answers", () => {
    it("schedules and logs a correct answer once, and returns the same answer to a retry", async () => {
      const now = later();
      const first = await mod.review.recordAnswer(alice, sense("main"), submission(), now);
      expect(first).toEqual({
        status: "recorded",
        answer: {
          reviewNumber: 1,
          exerciseId: `term:${sense("main")}:ex1`,
          exerciseType: "term",
          outcome: "correct",
          answerMatch: "expected",
          answer: "significant",
          expected: "significant",
          mistakeId: null,
          boxBefore: 0,
          boxAfter: 1,
          dueAfter: new Date(now.getTime() + DAY),
          reviewedAt: now,
        },
      });

      // The same submission again (a retry, a double click): nothing changes.
      const retry = await mod.review.recordAnswer(alice, sense("main"), submission(), later(1));
      expect(retry).toEqual({ ...first, status: "duplicate" });
      const state = await mod.cards.reviewStateOf(alice, sense("main"));
      expect(state?.card).toMatchObject({ box: 1, reviews: 1, lapses: 0 });
      expect(await logCount({ cardId: state!.cardId! })).toBe(1);
    });

    it("refuses a different answer for a review number already used", async () => {
      const stale = await mod.review.recordAnswer(
        alice,
        sense("main"),
        submission({ exerciseId: `mistake:${sense("main")}:of`, exerciseType: "mistake" }),
        later(1),
      );
      expect(stale).toEqual({ status: "stale" });
      expect(await logCount({ userId: alice, senseId: sense("main") })).toBe(1);
    });

    it("refuses an answer before the card is due, and takes it once it is", async () => {
      const early = await mod.review.recordAnswer(
        alice,
        sense("main"),
        submission({ expectedReviews: 1 }),
        later(),
      );
      expect(early).toEqual({ status: "not_due" });

      const due = later(1);
      const wrong = await mod.review.recordAnswer(
        alice,
        sense("main"),
        submission({
          expectedReviews: 1,
          exerciseId: `preposition:${sense("main")}:ex2`,
          exerciseType: "preposition",
          outcome: "incorrect",
          answerMatch: "mistake",
          answer: "of",
          expected: "for",
          mistakeId: `${sense("main")}:of`,
        }),
        due,
      );
      expect(wrong).toMatchObject({
        status: "recorded",
        answer: { reviewNumber: 2, outcome: "incorrect", boxBefore: 1, boxAfter: 1 },
      });
      const state = await mod.cards.reviewStateOf(alice, sense("main"));
      expect(state?.card).toEqual({
        box: 1,
        dueAt: new Date(due.getTime() + DAY),
        reviews: 2,
        lapses: 1,
        lastReviewedAt: due,
      });
    });

    it("records many identical concurrent submissions exactly once", async () => {
      await mod.saved.saveSense(alice, sense("race"));
      const now = later();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          mod.review.recordAnswer(
            alice,
            sense("race"),
            submission({ exerciseId: "term:race:ex1" }),
            now,
          ),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual(["duplicate", ...Array(6).fill("duplicate"), "recorded"].sort());
      expect(await logCount({ userId: alice, senseId: sense("race") })).toBe(1);
      expect((await mod.cards.reviewStateOf(alice, sense("race")))?.card.reviews).toBe(1);
    });

    it("lets only one of several different concurrent answers win", async () => {
      await mod.saved.saveSense(alice, sense("race2"));
      const now = later();
      const results = await Promise.all(
        ["term:race2:ex1", "term:race2:ex2", "mistake:race2:m1"].map((exerciseId) =>
          mod.review.recordAnswer(alice, sense("race2"), submission({ exerciseId }), now),
        ),
      );
      expect(results.filter((r) => r.status === "recorded")).toHaveLength(1);
      expect(results.filter((r) => r.status === "stale")).toHaveLength(2);
      expect(await logCount({ userId: alice, senseId: sense("race2") })).toBe(1);
    });

    it("never touches another learner's card", async () => {
      const result = await mod.review.recordAnswer(bob, sense("main"), submission(), later(5));
      expect(result).toEqual({ status: "not_saved" });
      expect(await cardCount(bob)).toBe(0);
      expect(await logCount({ userId: bob })).toBe(0);
    });

    it("refuses answers for a retired sense, keeping the save", async () => {
      const { db, schema } = mod;
      // Saved while published, retired since.
      await db.insert(schema.savedSenses).values({ userId: alice, senseId: sense("retired") });
      const state = await mod.cards.reviewStateOf(alice, sense("retired"));
      expect(state?.retired).toBe(true);
      const result = await mod.review.recordAnswer(
        alice,
        sense("retired"),
        submission({ exerciseId: "term:retired:ex1" }),
        later(),
      );
      expect(result).toEqual({ status: "retired" });
      expect(await logCount({ userId: alice, senseId: sense("retired") })).toBe(0);
    });
  });

  describe("removing", () => {
    it("removes the card with the save, keeps the history, and starts again on a new save", async () => {
      const before = await mod.cards.reviewStateOf(alice, sense("main"));
      expect(await logCount({ cardId: before!.cardId! })).toBe(2);

      await mod.saved.removeSavedSense(alice, sense("main"));
      expect(await cardCount(alice, sense("main"))).toBe(0);
      expect(await mod.cards.reviewStateOf(alice, sense("main"))).toBeNull();
      expect(await logCount({ cardId: before!.cardId! })).toBe(2);

      await mod.saved.saveSense(alice, sense("main"));
      const again = await mod.cards.reviewStateOf(alice, sense("main"));
      expect(again?.cardId).not.toBe(before!.cardId);
      expect(again?.card).toMatchObject({ box: 0, reviews: 0, lapses: 0 });
      // The new card numbers its answers from 1 again; the old history is untouched.
      const result = await mod.review.recordAnswer(alice, sense("main"), submission(), later());
      expect(result).toMatchObject({ status: "recorded", answer: { reviewNumber: 1 } });
      expect(await logCount({ userId: alice, senseId: sense("main") })).toBe(3);
    });

    it("deletes a learner's saves, cards and history with their account", async () => {
      const { db, schema } = mod;
      await mod.saved.saveSense(carol, sense("other"));
      await mod.review.recordAnswer(
        carol,
        sense("other"),
        submission({ exerciseId: "term:other:ex1" }),
        later(),
      );
      expect(await cardCount(carol)).toBe(1);
      expect(await logCount({ userId: carol })).toBe(1);

      await db.delete(schema.users).where(eq(schema.users.id, carol));
      expect(await cardCount(carol)).toBe(0);
      expect(await logCount({ userId: carol })).toBe(0);
      const [saves] = await db
        .select({ n: count() })
        .from(schema.savedSenses)
        .where(eq(schema.savedSenses.userId, carol));
      expect(saves!.n).toBe(0);
    });

    it("won't let a sense with review history be deleted, even once no one has it saved", async () => {
      const { db, schema } = mod;
      await mod.saved.removeSavedSense(alice, sense("main"));
      expect(await logCount({ senseId: sense("main") })).toBeGreaterThan(0);
      await expect(
        db.delete(schema.senses).where(eq(schema.senses.id, sense("main"))),
      ).rejects.toThrow();
    });
  });
});
