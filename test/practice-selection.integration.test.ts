import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Outcome } from "@/learning/scheduler";

/**
 * Practice selection against PostgreSQL (Phase 7.3): what a review session takes first and why,
 * from answers recorded through the review loop's own `recordAnswer`. Selection agrees with
 * Review's due queue, the learning state and the bank; it never selects what isn't due; it reads
 * in a fixed number of statements; and one learner's history never affects another's. The full
 * loop runs through `loadReviewSession` and `answerReview`. Throwaway rows with unique IDs,
 * removed afterwards. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!hasDatabase)("practice selection (PostgreSQL)", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    saved: typeof import("@/server/repositories/saved-senses");
    cards: typeof import("@/server/repositories/review-cards");
    practice: typeof import("@/server/repositories/language/practice");
    review: typeof import("@/server/learning/review");
    bank: typeof import("@/server/learning/bank");
    state: typeof import("@/server/learning/state");
    selection: typeof import("@/server/learning/selection");
    exercises: typeof import("@/learning/exercises");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-item-${run}`;
  const KEYS = [
    "fresh1",
    "fresh2",
    "right",
    "missed1",
    "missed3",
    "known",
    "again",
    "retired",
    "loop",
  ];
  const sense = (key: string) => `${itemId}.${key}`;
  const [alice, bob, carol, dave] = ["a", "b", "c", "d"].map(
    (key) => `it-selection-${key}-${run}`,
  ) as [string, string, string, string];
  /** Just after the setup: only the new saves are due. */
  const soon = () => new Date(Date.now() + 5 * 60_000);
  /** Long after every answer: everything answered is due again. */
  const far = () => new Date(Date.now() + 90 * DAY);

  /** Answers a saved sense as soon as its card is due, through the review loop's own recording. */
  async function answer(userId: string, senseId: string, outcomes: Outcome[]) {
    for (const outcome of outcomes) {
      const state = await mod.cards.reviewStateOf(userId, senseId);
      const at = new Date(Math.max(state!.card.dueAt.getTime(), Date.now()) + 60_000);
      const result = await mod.review.recordAnswer(
        userId,
        senseId,
        {
          expectedReviews: state!.card.reviews,
          exerciseId: `mistake:${senseId}:m`,
          exerciseType: "mistake",
          outcome,
          answerMatch: outcome === "correct" ? "expected" : "mistake",
          answer: null,
          expected: "right",
          mistakeId: outcome === "correct" ? null : `${senseId}:m`,
        },
        at,
      );
      expect(result.status).toBe("recorded");
    }
  }

  const ids = (candidates: { state: { senseId: string } }[]) =>
    candidates.map((c) => c.state.senseId);

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      saved: await import("@/server/repositories/saved-senses"),
      cards: await import("@/server/repositories/review-cards"),
      practice: await import("@/server/repositories/language/practice"),
      review: await import("@/server/learning/review"),
      bank: await import("@/server/learning/bank"),
      state: await import("@/server/learning/state"),
      selection: await import("@/server/learning/selection"),
      exercises: await import("@/learning/exercises"),
    };
    const { db, schema } = mod;
    await db.insert(schema.users).values(
      [alice, bob, carol, dave].map((id) => ({
        id,
        name: "Learner",
        email: `${id}@lexora.test`,
      })),
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
      headword: `term-${run}`,
      normalized: `term-${run}`,
      status: "published",
      sourceId,
      authoredBy: "test",
    });
    await db.insert(schema.senses).values(
      KEYS.map((key, position) => ({
        id: sense(key),
        itemId,
        position,
        label: key,
        partOfSpeech: "adjective" as const,
        definition: `Definition ${key}.`,
        cefr: "B2" as const,
        registers: ["neutral" as const],
        skills: ["writing" as const],
        ieltsRelevance: "core" as const,
        ieltsTasks: ["writing-2" as const],
        bestWhen: "Testing.",
      })),
    );
    // One authored mistake each: a "which is correct?" exercise for every sense.
    await db.insert(schema.mistakes).values(
      KEYS.map((key, position) => ({
        id: `${sense(key)}:m`,
        senseId: sense(key),
        wrong: `They wrong ${key}.`,
        wrongNormalized: `they wrong ${key}.`,
        right: `They right ${key}.`,
        explanation: "Test.",
        type: "grammar" as const,
        position,
      })),
    );

    // Saved in this order, so new saves come in it (Review orders new by save time).
    for (const key of KEYS.filter((k) => k !== "loop")) {
      expect(await mod.saved.saveSense(alice, sense(key))).toBe("saved");
    }
    await answer(alice, sense("right"), ["correct"]);
    await answer(alice, sense("missed1"), ["correct", "incorrect"]);
    await answer(alice, sense("missed3"), ["incorrect", "incorrect", "incorrect"]);
    await answer(alice, sense("known"), ["correct", "correct", "correct", "correct"]);
    await answer(alice, sense("retired"), ["incorrect"]);
    await db
      .update(schema.senses)
      .set({ status: "retired" })
      .where(eq(schema.senses.id, sense("retired")));
    // Practised, removed (the card goes, the log stays), then saved again.
    await answer(alice, sense("again"), ["correct", "incorrect"]);
    await mod.saved.removeSavedSense(alice, sense("again"));
    expect(await mod.saved.saveSense(alice, sense("again"))).toBe("saved");
  }, 60_000);

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    // Users first: their saves, cards and review log go with them (cascade).
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob, carol, dave]));
    await db.delete(schema.mistakes).where(inArray(schema.mistakes.senseId, KEYS.map(sense)));
    await db.delete(schema.senses).where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.languageItems).where(eq(schema.languageItems.id, itemId));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
  });

  describe("priority", () => {
    it("takes missed first (more misses in a row first), then other due (learning before known), then new", async () => {
      const selected = await mod.selection.selectPracticeCandidates(alice, far(), 50);
      expect(selected.map((c) => [c.state.senseId, c.tier, c.reason])).toEqual([
        [sense("missed3"), "missed", { code: "missed", times: 3 }],
        [sense("missed1"), "missed", { code: "missed", times: 1 }],
        [sense("right"), "due", { code: "due" }],
        [sense("known"), "due", { code: "due" }],
        [sense("fresh1"), "new", { code: "not_practised" }],
        [sense("fresh2"), "new", { code: "not_practised" }],
        [sense("again"), "new", { code: "saved_again" }],
      ]);
    });

    it("never selects what isn't due: just after the answers, only the new saves", async () => {
      const selected = await mod.selection.selectPracticeCandidates(alice, soon(), 50);
      expect(ids(selected)).toEqual([sense("fresh1"), sense("fresh2"), sense("again")]);
      expect(selected.every((c) => c.tier === "new" && c.state.due)).toBe(true);
    });

    it("never selects a retired sense, and lists each sense once", async () => {
      const selected = ids(await mod.selection.selectPracticeCandidates(alice, far(), 50));
      expect(selected).not.toContain(sense("retired"));
      expect(new Set(selected).size).toBe(selected.length);
    });

    it("is the same every time it's asked at the same moment", async () => {
      const now = far();
      const first = await mod.selection.selectPracticeCandidates(alice, now, 50);
      const second = await mod.selection.selectPracticeCandidates(alice, now, 50);
      expect(second).toEqual(first);
    });
  });

  describe("agreement with Review, the learning state and the bank", () => {
    it("selects exactly Review's due queue, with each sense's learning state", async () => {
      for (const now of [soon(), far()]) {
        const selected = await mod.selection.selectPracticeCandidates(alice, now, 50);
        const queue = await mod.cards.reviewQueue(alice, now, { when: "due", limit: 50 });
        expect(ids(selected).sort()).toEqual(queue.map((q) => q.senseId).sort());
        const states = await mod.state.loadLearningStates(alice, null, now);
        for (const candidate of selected) {
          expect(candidate.state).toEqual(states.get(candidate.state.senseId));
        }
        const due = [...states.values()].filter((s) => s.due).map((s) => s.senseId);
        expect(ids(selected).sort()).toEqual(due.sort());
      }
    });

    it("gives each sense the stage the bank shows", async () => {
      const now = far();
      const selected = await mod.selection.selectPracticeCandidates(alice, now, 50);
      const { rows } = await mod.bank.loadBankPage(alice, 1, now);
      for (const candidate of selected) {
        const row = rows.find((r) => r.senseId === candidate.state.senseId)!;
        expect([row.stage, row.due]).toEqual([candidate.state.stage, true]);
      }
    });

    it("orders the review session the same way, each item with its reason", async () => {
      const session = await mod.review.loadReviewSession(alice, far());
      expect(session.kind).toBe("session");
      if (session.kind !== "session") return;
      const selected = await mod.selection.selectPracticeCandidates(alice, far(), 5);
      expect(session.items.map((item) => [item.senseId, item.reason])).toEqual(
        selected.map((c) => [c.state.senseId, c.reason]),
      );
      expect(session.more).toBe(true);
    });
  });

  describe("limits and empty pools", () => {
    it("returns at most the requested number, in order", async () => {
      const all = ids(await mod.selection.selectPracticeCandidates(alice, far(), 50));
      expect(ids(await mod.selection.selectPracticeCandidates(alice, far(), 3))).toEqual(
        all.slice(0, 3),
      );
      expect(await mod.selection.selectPracticeCandidates(alice, far(), 0)).toEqual([]);
      expect(await mod.selection.selectPracticeCandidates(alice, far(), -4)).toEqual([]);
      expect(await mod.selection.selectPracticeCandidates(alice, far(), 2.9)).toHaveLength(2);
      expect(await mod.selection.selectPracticeCandidates(alice, far(), 1e9)).toHaveLength(
        all.length,
      );
    });

    it("selects nothing for an empty bank, and Practice stays as it was", async () => {
      expect(await mod.selection.selectPracticeCandidates(carol, far(), 5)).toEqual([]);
      expect(await mod.review.loadReviewSession(carol, far())).toEqual({ kind: "empty" });
    });
  });

  describe("privacy", () => {
    it("selects from one learner's saves and history only", async () => {
      await mod.saved.saveSense(bob, sense("fresh1"));
      await answer(bob, sense("fresh1"), ["incorrect", "incorrect"]);
      const bobs = await mod.selection.selectPracticeCandidates(bob, far(), 50);
      expect(bobs.map((c) => [c.state.senseId, c.tier, c.reason])).toEqual([
        [sense("fresh1"), "missed", { code: "missed", times: 2 }],
      ]);
      const alices = await mod.selection.selectPracticeCandidates(alice, far(), 50);
      expect(alices.find((c) => c.state.senseId === sense("fresh1"))).toMatchObject({
        tier: "new",
        reason: { code: "not_practised" },
      });
    });
  });

  describe("batched reads", () => {
    it("selects in two statements whatever the pool's size, learning state in one", async () => {
      const client = mod.db.$client as unknown as {
        options: { debug?: (connection: number, query: string) => void };
      };
      const counted = async (fn: () => Promise<unknown>) => {
        const statements: string[] = [];
        client.options.debug = (_connection, query) => statements.push(query);
        try {
          await fn();
          return statements;
        } finally {
          delete client.options.debug;
        }
      };
      const small = await counted(() => mod.selection.selectPracticeCandidates(bob, far(), 5));
      const large = await counted(() => mod.selection.selectPracticeCandidates(alice, far(), 5));
      for (const statements of [small, large]) {
        expect(statements).toHaveLength(2);
        expect(statements.filter((q) => q.includes("with saved as"))).toHaveLength(1);
      }
      // A session adds only the practice material of the senses it takes.
      const session = await counted(() => mod.review.loadReviewSession(alice, far()));
      expect(session).toHaveLength(2 + 4);
      expect(
        await counted(() => mod.selection.selectPracticeCandidates(carol, far(), 5)),
      ).toHaveLength(1);
    });
  });

  describe("the full loop", () => {
    it("save → selected → practise → answer → state changes → selection changes; remove; save again", async () => {
      const loop = sense("loop");
      const select = async (now: Date) =>
        (await mod.selection.selectPracticeCandidates(dave, now, 5)).map((c) => [
          c.state.senseId,
          c.tier,
          c.reason,
        ]);
      /** Answers the session's first item, right or wrong, through answerReview. */
      const practise = async (now: Date, right: boolean) => {
        const session = await mod.review.loadReviewSession(dave, now);
        expect(session.kind).toBe("session");
        if (session.kind !== "session") throw new Error("no session");
        const item = session.items[0]!;
        const [material] = await mod.practice.loadPracticeMaterial(mod.db, [item.senseId]);
        const exercise = mod.exercises.exerciseFor(material!, item.expectedReviews)!;
        if (exercise.key.kind !== "choice") throw new Error("expected a choice");
        const result = await mod.review.answerReview(
          dave,
          {
            senseId: item.senseId,
            exerciseId: item.prompt.id,
            expectedReviews: item.expectedReviews,
            answer: right ? exercise.key.correctOption : exercise.key.wrongOption,
          },
          now,
        );
        expect(result.status).toBe("recorded");
        return item;
      };

      const t0 = new Date(Date.now() + 60_000);
      expect(await select(t0)).toEqual([]);
      await mod.saved.saveSense(dave, loop);
      expect(await select(t0)).toEqual([[loop, "new", { code: "not_practised" }]]);

      const first = await practise(t0, false);
      expect(first.reason).toEqual({ code: "not_practised" });
      expect(await mod.state.loadLearningState(dave, loop, t0)).toMatchObject({
        stage: "learning",
        due: false,
        reason: { code: "missed", times: 1 },
      });
      expect(await select(t0)).toEqual([]); // back tomorrow, not before
      expect(await mod.review.loadReviewSession(dave, t0)).toMatchObject({ kind: "caught_up" });

      const t1 = new Date(t0.getTime() + DAY + 60_000);
      expect(await select(t1)).toEqual([[loop, "missed", { code: "missed", times: 1 }]]);
      const second = await practise(t1, true);
      expect(second.reason).toEqual({ code: "missed", times: 1 });
      const t2 = new Date(t1.getTime() + 3 * DAY + 60_000);
      expect(await select(t2)).toEqual([[loop, "due", { code: "due" }]]);

      await mod.saved.removeSavedSense(dave, loop);
      expect(await select(t2)).toEqual([]);
      expect(await mod.review.loadReviewSession(dave, t2)).toEqual({ kind: "empty" });

      await mod.saved.saveSense(dave, loop);
      const t3 = new Date(Date.now() + 2 * 60_000);
      expect(await select(t3)).toEqual([[loop, "new", { code: "saved_again" }]]);
      expect(await mod.state.loadLearningState(dave, loop, t3)).toMatchObject({
        stage: "new",
        evidence: { attempts: 2, correct: 1, incorrect: 1 },
      });
    });
  });
});
