import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Outcome } from "@/learning/scheduler";

/**
 * The Phase 7.1 learning state against PostgreSQL: answers recorded through the review loop's own
 * `recordAnswer` become stages, evidence and reasons that agree with the review card, the bank's
 * counts, the review queue and the pure reference rule (`evidenceFrom`); one learner never sees
 * another's; and a collection is read in one statement. Throwaway rows with unique IDs, removed
 * afterwards. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("learning state (PostgreSQL)", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    saved: typeof import("@/server/repositories/saved-senses");
    cards: typeof import("@/server/repositories/review-cards");
    review: typeof import("@/server/learning/review");
    service: typeof import("@/server/learning/state");
    state: typeof import("@/learning/state");
    status: typeof import("@/learning/status");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-item-${run}`;
  const sense = (key: string) => `${itemId}.${key}`;
  const KEYS = ["fresh", "right", "wrong", "misses", "strong", "again", "retired", "unsaved"];
  const [alice, bob] = ["a", "b"].map((key) => `it-learning-${key}-${run}`) as [string, string];
  /** The latest time an answer was recorded at, so later reads see every card as answered. */
  let clock = new Date(Date.now() + 60_000);

  /** Answers a saved sense as soon as its card is due, through the review loop's own recording. */
  async function answer(userId: string, senseId: string, outcomes: Outcome[]) {
    for (const outcome of outcomes) {
      const state = await mod.cards.reviewStateOf(userId, senseId);
      const due = state!.card.dueAt.getTime() + 60_000;
      const at = new Date(Math.max(due, Date.now() + 60_000));
      const result = await mod.review.recordAnswer(
        userId,
        senseId,
        {
          expectedReviews: state!.card.reviews,
          exerciseId: `term:${senseId}:ex1`,
          exerciseType: "term",
          outcome,
          answerMatch: outcome === "correct" ? "expected" : "unrecognised",
          answer: outcome === "correct" ? "significant" : "signify",
          expected: "significant",
          mistakeId: null,
        },
        at,
      );
      expect(result.status).toBe("recorded");
      if (at > clock) clock = at;
    }
  }

  /** The learner's log rows on a sense, for the pure reference rule. */
  async function logOf(userId: string, senseId: string) {
    const { reviewLog } = mod.schema;
    return mod.db
      .select({
        outcome: reviewLog.outcome,
        reviewedAt: reviewLog.reviewedAt,
        reviewNumber: reviewLog.reviewNumber,
      })
      .from(reviewLog)
      .where(and(eq(reviewLog.userId, userId), eq(reviewLog.senseId, senseId)))
      .orderBy(asc(reviewLog.reviewedAt));
  }

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      saved: await import("@/server/repositories/saved-senses"),
      cards: await import("@/server/repositories/review-cards"),
      review: await import("@/server/learning/review"),
      service: await import("@/server/learning/state"),
      state: await import("@/learning/state"),
      status: await import("@/learning/status"),
    };
    const { db, schema } = mod;
    await db
      .insert(schema.users)
      .values([alice, bob].map((id) => ({ id, name: "Learner", email: `${id}@lexora.test` })));
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
    await db.insert(schema.senses).values(
      KEYS.map((key, position) => ({
        id: sense(key),
        itemId,
        position,
        partOfSpeech: "adjective" as const,
        definition: "Test definition.",
        cefr: "B2" as const,
        registers: ["neutral" as const],
        skills: ["writing" as const],
        ieltsRelevance: "core" as const,
        ieltsTasks: ["writing-2" as const],
        bestWhen: "Testing.",
      })),
    );

    for (const key of KEYS.filter((k) => k !== "unsaved")) {
      expect(await mod.saved.saveSense(alice, sense(key))).toBe("saved");
    }
    await answer(alice, sense("right"), ["correct"]);
    await answer(alice, sense("wrong"), ["incorrect"]);
    await answer(alice, sense("misses"), ["correct", "incorrect", "incorrect", "incorrect"]);
    await answer(alice, sense("strong"), ["correct", "correct", "correct", "correct"]);
    await answer(alice, sense("retired"), ["incorrect"]);
    await db
      .update(schema.senses)
      .set({ status: "retired" })
      .where(eq(schema.senses.id, sense("retired")));
    // Practised, removed (the card goes, the log stays), then saved again.
    await answer(alice, sense("again"), ["correct", "incorrect"]);
    await mod.saved.removeSavedSense(alice, sense("again"));
    expect(await mod.saved.saveSense(alice, sense("again"))).toBe("saved");

    // Bob practises one of the same senses, differently.
    await mod.saved.saveSense(bob, sense("strong"));
    await answer(bob, sense("strong"), ["incorrect", "incorrect"]);
  });

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    // Users first: their saves, cards and review log go with them (cascade).
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob]));
    await db.delete(schema.senses).where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.languageItems).where(eq(schema.languageItems.id, itemId));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
  });

  const statesOf = (userId: string, keys: string[] | null) =>
    mod.service.loadLearningStates(userId, keys && keys.map(sense), clock);

  describe("stages, evidence and reasons", () => {
    it("a saved sense with no answers is new, due and not practised", async () => {
      const state = await mod.service.loadLearningState(alice, sense("fresh"), clock);
      expect(state).toMatchObject({
        senseId: sense("fresh"),
        stage: "new",
        due: true,
        retired: false,
        evidence: mod.state.NO_EVIDENCE,
        reason: { code: "not_practised" },
      });
    });

    it("a first correct answer: learning, scheduled, one correct", async () => {
      const state = (await mod.service.loadLearningState(alice, sense("right"), clock))!;
      expect(state).toMatchObject({
        stage: "learning",
        evidence: { attempts: 1, correct: 1, incorrect: 0 },
        reason: { code: "correct", times: 1 },
      });
      expect(state.evidence.lastPractisedAt).toBeInstanceOf(Date);
    });

    it("a first wrong answer: learning, missed last time", async () => {
      expect(await mod.service.loadLearningState(alice, sense("wrong"), clock)).toMatchObject({
        stage: "learning",
        evidence: { attempts: 1, correct: 0, incorrect: 1 },
        reason: { code: "missed", times: 1 },
      });
    });

    it("repeated misses: learning, with the misses in a row", async () => {
      expect(await mod.service.loadLearningState(alice, sense("misses"), clock)).toMatchObject({
        stage: "learning",
        evidence: { attempts: 4, correct: 1, incorrect: 3 },
        reason: { code: "missed", times: 3 },
      });
    });

    it("consistent correct answers: known", async () => {
      expect(await mod.service.loadLearningState(alice, sense("strong"), clock)).toMatchObject({
        stage: "known",
        evidence: { attempts: 4, correct: 4, incorrect: 0 },
        reason: { code: "correct", times: 4 },
      });
    });

    it("a retired sense keeps its evidence but isn't due", async () => {
      expect(await mod.service.loadLearningState(alice, sense("retired"), clock)).toMatchObject({
        retired: true,
        due: false,
        nextReview: null,
        stage: "learning",
        evidence: { attempts: 1, incorrect: 1 },
      });
    });

    it("saved again: a new card, with the earlier answers still counted as evidence", async () => {
      const state = (await mod.service.loadLearningState(alice, sense("again"), clock))!;
      const review = await mod.cards.reviewStateOf(alice, sense("again"));
      expect(review?.card).toMatchObject({ box: 0, reviews: 0 });
      expect(state).toMatchObject({
        stage: "new",
        due: true,
        evidence: { attempts: 2, correct: 1, incorrect: 1, latest: { outcome: "incorrect" } },
        reason: { code: "saved_again" },
      });
    });

    it("has no state for a sense the learner hasn't saved", async () => {
      expect(await mod.service.loadLearningState(alice, sense("unsaved"), clock)).toBeNull();
      expect((await statesOf(alice, ["unsaved", "fresh"])).has(sense("unsaved"))).toBe(false);
    });
  });

  describe("agreement with the review loop", () => {
    it("SQL evidence equals the pure reference rule over the learner's log", async () => {
      const states = await statesOf(alice, null);
      expect(states.size).toBe(KEYS.length - 1);
      for (const [senseId, state] of states) {
        expect(state.evidence).toEqual(mod.state.evidenceFrom(await logOf(alice, senseId)));
      }
    });

    it("counts the card's answers when there's no earlier save", async () => {
      const states = await statesOf(alice, null);
      for (const [senseId, state] of states) {
        if (senseId === sense("again")) continue;
        const review = (await mod.cards.reviewStateOf(alice, senseId))!;
        expect(state.evidence.attempts).toBe(review.card.reviews);
        expect(state.evidence.incorrect).toBe(review.card.lapses);
        expect(state.evidence.lastPractisedAt).toEqual(review.card.lastReviewedAt);
      }
    });

    it("stage and due agree with the bank's status, counts and the review queue", async () => {
      for (const at of [clock, new Date(clock.getTime() + 40 * 24 * 60 * 60 * 1000)]) {
        const states = await mod.service.loadLearningStates(alice, null, at);
        const counts = await mod.cards.bankCounts(alice, at);
        const live = [...states.values()].filter((s) => !s.retired);
        expect(counts.retired).toBe(states.size - live.length);
        expect(counts.new).toBe(live.filter((s) => s.stage === "new").length);
        expect(counts.due).toBe(live.filter((s) => s.due && s.stage !== "new").length);
        expect(counts.known).toBe(live.filter((s) => !s.due && s.stage === "known").length);
        expect(counts.learning).toBe(live.filter((s) => !s.due && s.stage === "learning").length);

        const queue = await mod.cards.reviewQueue(alice, at, { when: "due", limit: 50 });
        const dueIds = live.filter((s) => s.due).map((s) => s.senseId);
        expect(queue.map((q) => q.senseId).sort()).toEqual(dueIds.sort());

        for (const entry of queue) {
          const status = mod.status.reviewStatus(
            { card: entry.card, retired: false, hasExercise: true },
            at,
          );
          const state = states.get(entry.senseId)!;
          expect(status).toBe(state.stage === "new" ? "new" : "due");
        }
      }
    });
  });

  describe("privacy", () => {
    it("one learner's state is built from their own answers only", async () => {
      expect(await mod.service.loadLearningState(bob, sense("strong"), clock)).toMatchObject({
        stage: "learning",
        evidence: { attempts: 2, correct: 0, incorrect: 2 },
        reason: { code: "missed", times: 2 },
      });
      expect(await mod.service.loadLearningState(alice, sense("strong"), clock)).toMatchObject({
        evidence: { attempts: 4, incorrect: 0 },
      });
    });

    it("never returns another learner's saved senses", async () => {
      const bobs = await mod.service.loadLearningStates(bob, null, clock);
      expect([...bobs.keys()]).toEqual([sense("strong")]);
      const asked = await statesOf(bob, KEYS);
      expect([...asked.keys()]).toEqual([sense("strong")]);
      expect(await mod.service.loadLearningState(bob, sense("misses"), clock)).toBeNull();
    });

    it("has nothing for an unknown user", async () => {
      expect((await statesOf(`it-learning-nobody-${run}`, null)).size).toBe(0);
    });
  });

  describe("batched reads", () => {
    it("reads any number of senses in one statement, and none for an empty list", async () => {
      const statements: string[] = [];
      const client = postgres(process.env.DATABASE_URL!, {
        max: 1,
        onnotice: () => {},
        debug: (_connection, query) => statements.push(query),
      });
      const counted = drizzle(client, { schema: mod.schema, casing: "snake_case" });
      try {
        // A new connection first fetches PostgreSQL's array types, once: not part of the read.
        await client`select 1`;
        for (const keys of [["fresh"], KEYS, null]) {
          statements.length = 0;
          const rows = await mod.cards.learningEvidence(
            counted as unknown as typeof mod.db,
            alice,
            keys && keys.map(sense),
          );
          expect(rows.length).toBeGreaterThan(0);
          expect(statements).toHaveLength(1);
        }
        statements.length = 0;
        expect(
          await mod.cards.learningEvidence(counted as unknown as typeof mod.db, alice, []),
        ).toEqual([]);
        expect(statements).toHaveLength(0);
      } finally {
        await client.end();
      }
    });

    it("returns one row per saved sense, ordered by sense ID, with duplicates asked once", async () => {
      const rows = await mod.cards.learningEvidence(mod.db, alice, [
        sense("strong"),
        sense("fresh"),
        sense("strong"),
      ]);
      expect(rows.map((row) => row.senseId)).toEqual([sense("fresh"), sense("strong")]);
    });
  });
});
