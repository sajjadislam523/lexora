import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Outcome } from "@/learning/scheduler";

/**
 * The learning-aware language bank against PostgreSQL (Phase 7.2): every row's stage, due, next
 * review, reason and status are the learning state Phase 7.1 computes (and the status Review
 * computes), the filters select exactly the senses whose learning state matches, pages stay
 * consistent, a page reads learning state in one batched statement whatever its size, and one
 * learner never sees another's. Answers are recorded through the review loop's own
 * `recordAnswer`. Throwaway rows with unique IDs, removed afterwards. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!hasDatabase)("learning-aware language bank (PostgreSQL)", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    saved: typeof import("@/server/repositories/saved-senses");
    cards: typeof import("@/server/repositories/review-cards");
    review: typeof import("@/server/learning/review");
    bank: typeof import("@/server/learning/bank");
    state: typeof import("@/server/learning/state");
    status: typeof import("@/learning/status");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-item-${run}`;
  /** 60 senses, `s00`–`s59`: more than one page of the bank. */
  const keys = Array.from({ length: 60 }, (_, i) => `s${String(i).padStart(2, "0")}`);
  const sense = (key: string) => `${itemId}.${key}`;
  const range = (from: number, to: number) => keys.slice(from, to + 1).map(sense);
  const [alice, bob] = ["a", "b"].map((key) => `it-bank-learning-${key}-${run}`) as [
    string,
    string,
  ];
  /** Just after the setup: only the 20 new saves are due. */
  const soon = () => new Date(Date.now() + 5 * 60_000);
  /** Long after: every live save is due. */
  const later = () => new Date(Date.now() + 40 * DAY);

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

  /** Every row of every page of a filtered bank at `now`. */
  async function allPages(
    userId: string,
    filter: import("@/server/learning/bank").BankFilter,
    now: Date,
  ) {
    const first = await mod.bank.loadBankPage(userId, 1, now, undefined, filter);
    const rest = [];
    for (let page = 2; page <= first.pages; page++) {
      rest.push(await mod.bank.loadBankPage(userId, page, now, undefined, filter));
    }
    return { first, pages: [first, ...rest], rows: [first, ...rest].flatMap((p) => p.rows) };
  }

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      saved: await import("@/server/repositories/saved-senses"),
      cards: await import("@/server/repositories/review-cards"),
      review: await import("@/server/learning/review"),
      bank: await import("@/server/learning/bank"),
      state: await import("@/server/learning/state"),
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
      headword: `term-${run}`,
      normalized: `term-${run}`,
      status: "published",
      sourceId,
      authoredBy: "test",
    });
    await db.insert(schema.senses).values(
      keys.map((key, position) => ({
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
    // One authored mistake each, so every sense has a review exercise.
    await db.insert(schema.mistakes).values(
      keys.map((key, position) => ({
        id: `${sense(key)}:m`,
        senseId: sense(key),
        wrong: `wrong ${key}`,
        wrongNormalized: `wrong ${key}`,
        right: `right ${key}`,
        explanation: "Test.",
        type: "grammar" as const,
        position,
      })),
    );

    for (const senseId of keys.map(sense)) {
      expect(await mod.saved.saveSense(alice, senseId)).toBe("saved");
    }
    // s00–s19 new; s20–s44 one right answer; s45–s49 missed twice; s50–s54 known;
    // s55–s57 right three times (box 3); s58 right then missed; s59 answered, then retired.
    for (const id of range(20, 44)) await answer(alice, id, ["correct"]);
    for (const id of range(45, 49)) await answer(alice, id, ["incorrect", "incorrect"]);
    for (const id of range(50, 54)) {
      await answer(alice, id, ["correct", "correct", "correct", "correct"]);
    }
    for (const id of range(55, 57)) await answer(alice, id, ["correct", "correct", "correct"]);
    await answer(alice, sense("s58"), ["correct", "incorrect"]);
    await answer(alice, sense("s59"), ["correct"]);
    await db
      .update(schema.senses)
      .set({ status: "retired" })
      .where(eq(schema.senses.id, sense("s59")));
  }, 60_000);

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    // Users first: their saves, cards and review log go with them (cascade).
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob]));
    await db.delete(schema.mistakes).where(inArray(schema.mistakes.senseId, keys.map(sense)));
    await db.delete(schema.senses).where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.languageItems).where(eq(schema.languageItems.id, itemId));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
  });

  describe("rows show the Phase 7.1 learning state", () => {
    it("every row on every page has its learning state's stage, due, next review and reason", async () => {
      for (const now of [soon(), later()]) {
        const { rows } = await allPages(alice, "all", now);
        expect(rows).toHaveLength(60);
        const states = await mod.state.loadLearningStates(alice, null, now);
        for (const row of rows) {
          const state = states.get(row.senseId)!;
          expect(row).toMatchObject({
            stage: state.stage,
            due: state.due,
            nextReview: state.nextReview,
            reason: state.reason,
          });
        }
      }
    });

    it("every row's status is the one Review computes from the card", async () => {
      for (const now of [soon(), later()]) {
        const { rows } = await allPages(alice, "all", now);
        for (const row of rows) {
          const review = (await mod.cards.reviewStateOf(alice, row.senseId))!;
          const status = mod.status.reviewStatus(
            { card: review.card, retired: review.retired, hasExercise: true },
            now,
          );
          expect(row.status, row.senseLabel ?? row.senseId).toBe(status);
        }
      }
    });

    it("rows for each stage say what was observed", async () => {
      const { rows } = await allPages(alice, "all", soon());
      const row = (key: string) => rows.find((r) => r.senseId === sense(key))!;
      expect(row("s00")).toMatchObject({
        status: "new",
        stage: "new",
        due: true,
        reason: { code: "not_practised" },
      });
      expect(row("s20")).toMatchObject({
        status: "learning",
        stage: "learning",
        due: false,
        nextReview: { due: false, days: 1 },
        reason: { code: "correct", times: 1 },
      });
      expect(row("s45")).toMatchObject({
        stage: "learning",
        reason: { code: "missed", times: 2 },
        missed: 2,
      });
      expect(row("s50")).toMatchObject({
        status: "known",
        stage: "known",
        reason: { code: "correct", times: 4 },
      });
      expect(row("s59")).toMatchObject({ status: "retired", due: false, nextReview: null });

      // Once due, a known sense is still known: its status is due and its stage known.
      const due = (await allPages(alice, "all", later())).rows.find(
        (r) => r.senseId === sense("s50"),
      );
      expect(due).toMatchObject({ status: "due", stage: "known", due: true });
    });
  });

  describe("filters", () => {
    it("count and list exactly the senses whose learning state matches, across pages", async () => {
      const matches: Record<
        import("@/server/learning/bank").BankFilter,
        (s: import("@/learning/state").LearningState) => boolean
      > = {
        all: () => true,
        new: (s) => !s.retired && s.stage === "new",
        learning: (s) => !s.retired && s.stage === "learning",
        known: (s) => !s.retired && s.stage === "known",
        due: (s) => s.due,
      };
      for (const now of [soon(), later()]) {
        const states = [...(await mod.state.loadLearningStates(alice, null, now)).values()];
        for (const filter of mod.bank.BANK_FILTERS) {
          const { first, rows } = await allPages(alice, filter, now);
          const expected = states
            .filter(matches[filter])
            .map((s) => s.senseId)
            .sort();
          expect(rows.map((r) => r.senseId).sort(), filter).toEqual(expected);
          expect(first.counts.filters[filter], filter).toBe(expected.length);
          expect(first.filter).toBe(filter);
          expect(new Set(rows.map((r) => r.senseId)).size).toBe(rows.length);
        }
      }
    });

    it("counts each stage, and due with the new ones, as the scenario was answered", async () => {
      const { counts } = await mod.bank.loadBankPage(alice, 1, soon());
      expect(counts.filters).toEqual({ all: 60, new: 20, learning: 34, known: 5, due: 20 });
      const far = await mod.bank.loadBankPage(alice, 1, later());
      expect(far.counts.filters).toEqual({ all: 60, new: 20, learning: 34, known: 5, due: 59 });
      // The Start review number is the Due filter's count.
      expect(far.counts.due + far.counts.new).toBe(far.counts.filters.due);
    });

    it("keep the bank's order, and page it", async () => {
      const now = later();
      const all = (await allPages(alice, "all", now)).rows.map((r) => r.senseId);
      const due = await allPages(alice, "due", now);
      expect(due.pages.map((p) => [p.page, p.pages, p.rows.length])).toEqual([
        [1, 2, 50],
        [2, 2, 9],
      ]);
      expect(due.rows.map((r) => r.senseId)).toEqual(all.filter((id) => id !== sense("s59")));
      const learning = (await allPages(alice, "learning", now)).rows.map((r) => r.senseId);
      expect(learning).toEqual(all.filter((id) => learning.includes(id)));
    });

    it("an empty filter has no rows and one page", async () => {
      const page = await mod.bank.loadBankPage(bob, 1, soon(), undefined, "known");
      expect(page).toMatchObject({ rows: [], page: 1, pages: 1, filter: "known" });
    });

    it("pages count the filtered rows, and a page past the end shows the last", async () => {
      const now = soon();
      expect((await mod.bank.loadBankCounts(alice, now)).pages).toBe(2);
      expect((await mod.bank.loadBankCounts(alice, now, "learning")).pages).toBe(1);
      const past = await mod.bank.loadBankPage(alice, 3, now, undefined, "learning");
      expect([past.page, past.pages, past.rows.length]).toEqual([1, 1, 34]);
    });
  });

  describe("batched reads", () => {
    it("reads a page in the same statements whatever its size, learning state in one", async () => {
      const client = mod.db.$client as unknown as {
        options: { debug?: (connection: number, query: string) => void };
      };
      const counted = async (filter: import("@/server/learning/bank").BankFilter) => {
        const statements: string[] = [];
        client.options.debug = (_connection, query) => statements.push(query);
        try {
          const page = await mod.bank.loadBankPage(alice, 1, soon(), undefined, filter);
          return { rows: page.rows.length, statements };
        } finally {
          delete client.options.debug;
        }
      };
      const known = await counted("known");
      const due = await counted("due");
      const all = await counted("all");
      expect([known.rows, due.rows, all.rows]).toEqual([5, 20, 50]);
      for (const { statements } of [known, due, all]) {
        expect(statements).toHaveLength(known.statements.length);
        expect(statements.filter((q) => q.includes("with saved as"))).toHaveLength(1);
      }
      // Counts, the page, learning state, four for practice material and one for mistakes.
      expect(known.statements).toHaveLength(8);
    });
  });

  describe("privacy and existing behaviour", () => {
    it("one learner's bank shows their own learning state only", async () => {
      await mod.saved.saveSense(bob, sense("s50"));
      await answer(bob, sense("s50"), ["incorrect"]);
      const bobs = await mod.bank.loadBankPage(bob, 1, soon());
      expect(bobs.rows.map((r) => [r.senseId, r.stage, r.reason])).toEqual([
        [sense("s50"), "learning", { code: "missed", times: 1 }],
      ]);
      expect(bobs.counts.filters).toEqual({ all: 1, new: 0, learning: 1, known: 0, due: 0 });
      const alices = await allPages(alice, "known", soon());
      expect(alices.rows.map((r) => r.senseId)).toContain(sense("s50"));
      expect((await mod.bank.loadBankPage(bob, 1, soon(), undefined, "known")).rows).toEqual([]);
    });

    it("a removed save leaves the bank and its filter; saved again, it's new with its history", async () => {
      await mod.saved.removeSavedSense(alice, sense("s45"));
      const removed = await mod.bank.loadBankPage(alice, 1, soon(), undefined, "learning");
      expect(removed.rows.map((r) => r.senseId)).not.toContain(sense("s45"));
      expect(removed.counts.filters.learning).toBe(33);

      await mod.saved.saveSense(alice, sense("s45"));
      const again = await mod.bank.loadBankPage(alice, 1, soon(), undefined, "new");
      expect(again.rows.find((r) => r.senseId === sense("s45"))).toMatchObject({
        status: "new",
        stage: "new",
        due: true,
        reason: { code: "saved_again" },
      });
      expect(again.counts.filters).toMatchObject({ new: 21, learning: 33 });
    });
  });
});
