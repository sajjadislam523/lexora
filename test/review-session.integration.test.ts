import { randomUUID } from "node:crypto";

import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AnswerInput } from "@/server/learning/review";
import type { RecurringMistake } from "@/server/repositories/review-cards";

/**
 * Review sessions and answers against PostgreSQL (Phase 5 Step 5; specification §14, §15): which
 * senses a session holds and in what order, and an answer checked against authored content,
 * scheduled and logged exactly once — with every refusal (stale, not due, changed exercise,
 * retired, unsaved, not an answer) recording nothing. A throwaway item whose main sense has all
 * three exercise types, removed afterwards. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-02T12:00:00.000Z");
const at = (days: number, hours = 0) => new Date(NOW.getTime() + days * DAY + hours * 3_600_000);

describe.skipIf(!hasDatabase)("review sessions and answers (PostgreSQL)", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    review: typeof import("@/server/learning/review");
    cards: typeof import("@/server/repositories/review-cards");
    bank: typeof import("@/server/learning/bank");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-rely-${run}`;
  const sense = (key: string) => `${itemId}.${key}`;
  const BULK = ["b1", "b2", "b3", "b4", "b5", "b6"];
  const users: string[] = [];
  const user = (key: string) => {
    const id = `it-session-${key}-${run}`;
    if (!users.includes(id)) users.push(id);
    return id;
  };

  // The main sense's exercises, in review order: term, preposition, then its two mistakes.
  const TERM = `term:${sense("main")}:ex1`;
  const PREPOSITION = `preposition:${sense("main")}:ex1`;
  const MISTAKE_OF = `mistake:${sense("main")}:of`;

  const input = (overrides: Partial<AnswerInput> = {}): AnswerInput => ({
    senseId: sense("main"),
    exerciseId: TERM,
    expectedReviews: 0,
    answer: "rely",
    ...overrides,
  });

  async function save(userId: string, key: string, savedAt = at(-1)) {
    await mod.db.insert(mod.schema.savedSenses).values({ userId, senseId: sense(key), savedAt });
  }
  const logs = async (userId: string) => {
    const [row] = await mod.db
      .select({ n: count() })
      .from(mod.schema.reviewLog)
      .where(eq(mod.schema.reviewLog.userId, userId));
    return row!.n;
  };
  const cardOf = async (userId: string, key = "main") => {
    const [card] = await mod.db
      .select()
      .from(mod.schema.reviewCards)
      .where(
        and(
          eq(mod.schema.reviewCards.userId, userId),
          eq(mod.schema.reviewCards.senseId, sense(key)),
        ),
      );
    return card;
  };

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      review: await import("@/server/learning/review"),
      cards: await import("@/server/repositories/review-cards"),
      bank: await import("@/server/learning/bank"),
    };
    const { db, schema } = mod;
    for (const key of [
      ...["empty", "order", "limit", "a", "b", "c", "d", "e", "f", "g", "h", "i"],
      ...["ev1", "ev2", "ev3", "ev4", "ev5", "ev6", "ev7", "flow"],
    ]) {
      user(key);
    }
    await db
      .insert(schema.users)
      .values(users.map((id) => ({ id, name: "Reviewer", email: `${id}@lexora.test` })));
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
      headword: "rely",
      normalized: "rely",
      status: "published",
      sourceId,
      authoredBy: "test",
    });
    await db.insert(schema.itemForms).values([
      { itemId, form: "rely", normalized: "rely", formType: "lemma", isDefault: true },
      { itemId, form: "relies", normalized: "relies", formType: "inflection" },
      { itemId, form: "relied", normalized: "relied", formType: "inflection" },
    ]);
    const base = {
      itemId,
      partOfSpeech: "verb" as const,
      cefr: "B2" as const,
      registers: ["neutral" as const],
      skills: ["writing" as const],
      ieltsRelevance: "core" as const,
      ieltsTasks: ["writing-2" as const],
    };
    await db.insert(schema.senses).values([
      {
        ...base,
        id: sense("main"),
        position: 0,
        label: "need",
        definition: "To need something or someone in order to work or succeed.",
        bestWhen: "Saying what something depends on.",
      },
      {
        ...base,
        id: sense("bare"),
        position: 1,
        label: "bare",
        definition: "No exercise.",
        bestWhen: "-",
      },
      ...BULK.map((key, i) => ({
        ...base,
        id: sense(key),
        position: 2 + i,
        label: key,
        definition: `Bulk ${key}.`,
        bestWhen: "-",
      })),
      {
        ...base,
        id: sense("retired"),
        position: 9,
        label: "retired",
        definition: "Retired.",
        bestWhen: "-",
        status: "retired" as const,
      },
    ]);
    await db.insert(schema.mistakes).values([
      {
        id: `${sense("main")}:of`,
        senseId: sense("main"),
        wrong: "Many students rely of online dictionaries.",
        wrongNormalized: "many students rely of online dictionaries",
        right: "Many students rely on online dictionaries.",
        explanation: "Rely takes on, not of.",
        type: "preposition",
        position: 0,
      },
      {
        id: `${sense("main")}:spelling`,
        senseId: sense("main"),
        wrong: "We realy on data.",
        wrongNormalized: "we realy on data",
        right: "We rely on data.",
        explanation: "Rely is spelled with one l and no a.",
        type: "word_form",
        position: 1,
      },
      ...[...BULK, "retired"].map((key) => ({
        id: `${sense(key)}:m`,
        senseId: sense(key),
        wrong: `wrong ${key}`,
        wrongNormalized: `wrong ${key}`,
        right: `right ${key}`,
        explanation: "Test.",
        type: "grammar" as const,
        position: 0,
      })),
    ]);
    await db.insert(schema.prepositionPatterns).values({
      id: `${sense("main")}:p1`,
      senseId: sense("main"),
      base: "rely",
      baseNormalized: "rely",
      preposition: "on",
      pattern: "rely on + noun",
      complement: "noun",
      note: "Rely is followed by on.",
      mistakeId: `${sense("main")}:of`,
      position: 0,
    });
    await db.insert(schema.examples).values({
      id: `${sense("main")}:ex1`,
      senseId: sense("main"),
      text: "Many students rely on online dictionaries.",
      highlights: [{ start: 14, end: 21 }],
      skill: "writing",
      prepositionPatternId: `${sense("main")}:p1`,
      position: 0,
      sourceId,
      practiceAccept: ["depend"],
      practiceAcceptPreposition: ["upon"],
    });
  });

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    const ids = ["main", "bare", "retired", ...BULK].map(sense);
    await db.delete(schema.users).where(inArray(schema.users.id, users));
    await db.delete(schema.examples).where(inArray(schema.examples.senseId, ids));
    await db
      .delete(schema.prepositionPatterns)
      .where(inArray(schema.prepositionPatterns.senseId, ids));
    await db.delete(schema.mistakes).where(inArray(schema.mistakes.senseId, ids));
    await db.delete(schema.senses).where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.itemForms).where(eq(schema.itemForms.itemId, itemId));
    await db.delete(schema.languageItems).where(eq(schema.languageItems.id, itemId));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
  });

  describe("selecting a session", () => {
    it("is empty with nothing saved", async () => {
      expect(await mod.review.loadReviewSession(user("empty"), NOW)).toEqual({ kind: "empty" });
    });

    it("holds due senses with an exercise, reviewed ones first, and never an answer key", async () => {
      const learner = user("order");
      await save(learner, "main", at(-5));
      await save(learner, "bare", at(-6)); // no exercise: never selected
      await save(learner, "retired", at(-7)); // retired: never selected
      await save(learner, "b1", at(-2));
      await save(learner, "b2", at(-20));
      // b2 has been answered and is due again: it comes first, though saved last of all.
      await mod.db.insert(mod.schema.reviewCards).values({
        userId: learner,
        senseId: sense("b2"),
        box: 1,
        reviews: 1,
        lapses: 0,
        dueAt: at(-1),
      });

      const session = await mod.review.loadReviewSession(learner, NOW);
      expect(session.kind).toBe("session");
      if (session.kind !== "session") return;
      expect(
        session.items.map((item) => [item.senseId, item.expectedReviews, item.prompt.id]),
      ).toEqual([
        [sense("b2"), 1, `mistake:${sense("b2")}:m`],
        [sense("main"), 0, TERM],
        [sense("b1"), 0, `mistake:${sense("b1")}:m`],
      ]);
      expect(session.more).toBe(false);
      const sent = JSON.stringify(session);
      expect(sent).not.toContain('"key"');
      expect(sent).not.toContain("depend"); // the authored accept list stays on the server
      // A typed exercise doesn't carry the headword (it would be the answer); a choice does.
      expect(session.items[1]!.prompt).not.toHaveProperty("term");
      expect(session.items[0]!.prompt).toHaveProperty("term", "rely");
      expect(session.items[1]!.prompt).toMatchObject({
        type: "term",
        sentence: ["Many students ", { gap: 0 }, " on online dictionaries."],
        cue: "To need something or someone in order to work or succeed.",
      });
    });

    it("holds at most five, and says when more is due", async () => {
      const learner = user("limit");
      for (const [i, key] of BULK.entries()) await save(learner, key, at(-10 + i));
      const session = await mod.review.loadReviewSession(learner, NOW);
      expect(session).toMatchObject({ kind: "session", more: true });
      if (session.kind !== "session") return;
      expect(session.items.map((item) => item.senseId)).toEqual(BULK.slice(0, 5).map(sense));
    });

    it("says when the next review is, once everything is answered", async () => {
      const learner = user("a");
      await save(learner, "main");
      expect((await mod.review.answerReview(learner, input(), NOW)).status).toBe("recorded");
      expect(await mod.review.loadReviewSession(learner, NOW)).toEqual({
        kind: "caught_up",
        nextReview: { due: false, days: 1 },
      });
      // A day later it is back, on its next exercise.
      const next = await mod.review.loadReviewSession(learner, at(1));
      expect(next).toMatchObject({
        kind: "session",
        items: [{ senseId: sense("main"), expectedReviews: 1, prompt: { id: PREPOSITION } }],
      });
    });
  });

  describe("answering", () => {
    it("records a correct answer once, with the scheduler's next review", async () => {
      const learner = user("b");
      await save(learner, "main");
      const result = await mod.review.answerReview(learner, input({ answer: "  Rely " }), NOW);
      expect(result).toEqual({
        status: "recorded",
        feedback: {
          duplicate: false,
          outcome: "correct",
          match: "expected",
          expected: "rely",
          accepted: ["depend"],
          explanation: null,
          pattern: null,
          term: "rely",
          senseLabel: "need",
          href: `/language/${itemId}#sense-main`,
          nextReview: { due: false, days: 1 },
          evidence: null,
        },
      });
      expect(await cardOf(learner)).toMatchObject({ box: 1, reviews: 1, lapses: 0 });
      const [row] = await mod.db
        .select()
        .from(mod.schema.reviewLog)
        .where(eq(mod.schema.reviewLog.userId, learner));
      expect(row).toMatchObject({
        reviewNumber: 1,
        exerciseId: TERM,
        exerciseType: "term",
        outcome: "correct",
        answerMatch: "expected",
        answer: "rely",
        expected: "rely",
        mistakeId: null,
        boxBefore: 0,
        boxAfter: 1,
      });
      expect(row!.dueAfter.getTime()).toBe(at(1).getTime());

      // The same answer again (a double click, a retry): the stored result, nothing new.
      const again = await mod.review.answerReview(learner, input({ answer: "rely" }), NOW);
      expect(again).toMatchObject({
        status: "duplicate",
        feedback: { duplicate: true, outcome: "correct" },
      });
      expect(await logs(learner)).toBe(1);
      expect(await cardOf(learner)).toMatchObject({ reviews: 1 });
    });

    it("refuses what isn't the next answer, and records nothing for it", async () => {
      const learner = user("c");
      await save(learner, "main");
      const answer = (overrides: Partial<AnswerInput>, now = NOW) =>
        mod.review.answerReview(learner, input(overrides), now);

      expect(await answer({ exerciseId: PREPOSITION })).toEqual({ status: "exercise_changed" });
      expect(await answer({ answer: "!!!" })).toEqual({ status: "invalid_answer" });
      expect(await logs(learner)).toBe(0);

      expect((await answer({})).status).toBe("recorded");
      // Review number 1 again, for another exercise: already used.
      expect(await answer({ exerciseId: PREPOSITION })).toEqual({ status: "stale" });
      // The next review, before it is due.
      expect(await answer({ exerciseId: PREPOSITION, expectedReviews: 1, answer: "on" })).toEqual({
        status: "not_due",
      });
      expect(await logs(learner)).toBe(1);

      expect(await mod.review.answerReview(learner, input({ senseId: sense("b3") }), NOW)).toEqual({
        status: "not_saved",
      });
      await save(learner, "retired");
      expect(
        await mod.review.answerReview(
          learner,
          input({
            senseId: sense("retired"),
            exerciseId: `mistake:${sense("retired")}:m`,
            answer: "a",
          }),
          NOW,
        ),
      ).toEqual({ status: "retired" });
    });

    it("accepts other authored forms and accepted answers, and only those", async () => {
      const cases = [
        ["d", "relies", "correct", "form", null],
        ["e", "depend", "correct", "accepted", null],
        ["f", "realy", "incorrect", "mistake", "Rely is spelled with one l and no a."],
        ["g", "trust", "incorrect", "unrecognised", "Saying what something depends on."],
      ] as const;
      for (const [key, given, outcome, match, explanation] of cases) {
        const learner = user(key);
        await save(learner, "main");
        const result = await mod.review.answerReview(learner, input({ answer: given }), NOW);
        expect(result, given).toMatchObject({
          status: "recorded",
          feedback: { outcome, match, explanation },
        });
        expect(await cardOf(learner), given).toMatchObject({
          box: 1,
          lapses: outcome === "correct" ? 0 : 1,
        });
      }
    });

    it("checks a preposition and a which-is-correct, and sends a wrong answer back to box 1", async () => {
      const learner = user("h");
      await save(learner, "main");
      await mod.review.answerReview(learner, input(), NOW);

      const preposition = await mod.review.answerReview(
        learner,
        input({ exerciseId: PREPOSITION, expectedReviews: 1, answer: "upon" }),
        at(1),
      );
      expect(preposition).toMatchObject({
        status: "recorded",
        feedback: {
          outcome: "correct",
          match: "accepted",
          pattern: "rely on + noun",
          explanation: "Rely is followed by on.",
          nextReview: { due: false, days: 3 },
        },
      });
      expect(await cardOf(learner)).toMatchObject({ box: 2 });

      // Review 3 is the "of" mistake; with reviews = 2 and position 0 the right version is `a`.
      const wrong = await mod.review.answerReview(
        learner,
        input({ exerciseId: MISTAKE_OF, expectedReviews: 2, answer: "b" }),
        at(4),
      );
      expect(wrong).toMatchObject({
        status: "recorded",
        feedback: {
          outcome: "incorrect",
          match: "mistake",
          expected: "Many students rely on online dictionaries.",
          explanation: "Rely takes on, not of.",
          nextReview: { due: false, days: 1 },
        },
      });
      expect(await cardOf(learner)).toMatchObject({ box: 1, reviews: 3, lapses: 1 });
      const [row] = await mod.db
        .select()
        .from(mod.schema.reviewLog)
        .where(
          and(eq(mod.schema.reviewLog.userId, learner), eq(mod.schema.reviewLog.reviewNumber, 3)),
        );
      expect(row).toMatchObject({
        answer: null,
        mistakeId: `${sense("main")}:of`,
        boxBefore: 2,
        boxAfter: 1,
      });
    });

    it("records one answer when two arrive at once, and gives both the first one's result", async () => {
      const learner = user("i");
      await save(learner, "main");
      const results = await Promise.all([
        mod.review.answerReview(learner, input({ answer: "rely" }), NOW),
        mod.review.answerReview(learner, input({ answer: "trust" }), NOW),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(["duplicate", "recorded"]);
      const [first, second] = results.map((r) => ("feedback" in r ? r.feedback : null));
      expect(first!.outcome).toBe(second!.outcome);
      expect(await logs(learner)).toBe(1);
      expect(await cardOf(learner)).toMatchObject({ reviews: 1 });
    });
  });

  describe("personal mistake evidence", () => {
    const OF = `${sense("main")}:of`;
    const SPELLING = `${sense("main")}:spelling`;
    let number = 0;
    /** One recorded answer, written straight to the log at a known time. */
    async function logged(
      userId: string,
      reviewedAt: Date,
      answer: {
        outcome?: "correct" | "incorrect";
        mistakeId?: string | null;
        typed?: string | null;
      },
      key = "main",
    ) {
      const outcome = answer.outcome ?? "incorrect";
      await mod.db.insert(mod.schema.reviewLog).values({
        userId,
        cardId: "00000000-0000-4000-8000-000000000000",
        senseId: sense(key),
        reviewNumber: ++number,
        exerciseId: TERM,
        exerciseType: answer.typed === null ? "mistake" : "term",
        outcome,
        answerMatch:
          outcome === "correct" ? "expected" : answer.mistakeId ? "mistake" : "unrecognised",
        answer: answer.typed === undefined ? "realy" : answer.typed,
        expected: "rely",
        mistakeId: answer.mistakeId ?? null,
        boxBefore: 1,
        boxAfter: outcome === "correct" ? 2 : 1,
        dueAfter: reviewedAt,
        reviewedAt,
      });
    }
    const recurring = (userId: string, now = NOW, keys = ["main"]) =>
      mod.cards.recurringMistakes(mod.db, userId, keys.map(sense), now);
    const summary = (rows: RecurringMistake[]) =>
      rows.map((r) => [r.mistakeId, r.answer, r.times, r.lastAt.toISOString()]);

    it("needs the same mistake twice in 30 days, and keeps one record as it recurs", async () => {
      const learner = user("ev1");
      await logged(learner, at(-10), { mistakeId: SPELLING });
      expect(await recurring(learner)).toEqual([]); // once is not evidence

      await logged(learner, at(-3), { mistakeId: SPELLING });
      expect(summary(await recurring(learner))).toEqual([
        [SPELLING, "realy", 2, at(-3).toISOString()],
      ]);

      await logged(learner, at(-1), { mistakeId: SPELLING });
      expect(summary(await recurring(learner))).toEqual([
        [SPELLING, "realy", 3, at(-1).toISOString()],
      ]);
    });

    it("counts only the 30 days before now, by timestamp", async () => {
      const learner = user("ev2");
      await logged(learner, at(-30), { mistakeId: OF, typed: null }); // exactly 30 days: out
      await logged(learner, at(-1), { mistakeId: OF, typed: null });
      await logged(learner, at(1), { mistakeId: OF, typed: null }); // after now: not yet
      expect(await recurring(learner)).toEqual([]);
      // A millisecond later, the oldest one is inside the window.
      const nearly = new Date(NOW.getTime() - 1);
      expect(summary(await recurring(learner, nearly))).toEqual([
        [OF, null, 2, at(-1).toISOString()],
      ]);
    });

    it("keys a mistake by the authored mistake, or by the exact typed answer", async () => {
      const learner = user("ev3");
      // Typing the authored mistake and choosing it are the same mistake.
      await logged(learner, at(-5), { mistakeId: SPELLING });
      await logged(learner, at(-4), { mistakeId: SPELLING, typed: null });
      // Two different unrecognised answers are two mistakes, neither repeated.
      await logged(learner, at(-3), { typed: "trust" });
      await logged(learner, at(-2), { typed: "count" });
      // The same unrecognised answer twice is.
      await logged(learner, at(-2), { typed: "lean" });
      await logged(learner, at(-1), { typed: "lean" });
      // Correct answers never count.
      await logged(learner, at(-6), { outcome: "correct", typed: "rely" });
      await logged(learner, at(-6), { outcome: "correct", typed: "rely" });
      expect(summary(await recurring(learner))).toEqual([
        [null, "lean", 2, at(-1).toISOString()],
        [SPELLING, "realy", 2, at(-4).toISOString()],
      ]);
    });

    it("is resolved by the sense's two latest answers being correct, after it", async () => {
      const learner = user("ev4");
      await logged(learner, at(-5), { mistakeId: OF, typed: null });
      await logged(learner, at(-4), { mistakeId: OF, typed: null });
      await logged(learner, at(-3), { outcome: "correct", typed: "rely" });
      expect(await recurring(learner)).toHaveLength(1); // one correct answer isn't enough
      await logged(learner, at(-2), { outcome: "correct", typed: "rely" });
      expect(await recurring(learner)).toEqual([]);
      // Made again, it is back: its latest occurrence is after the correct answers.
      await logged(learner, at(-1), { mistakeId: OF, typed: null });
      expect(summary(await recurring(learner))).toEqual([[OF, null, 3, at(-1).toISOString()]]);
    });

    it("belongs to one learner and one sense", async () => {
      const [first, second] = [user("ev5"), user("ev6")];
      await logged(first, at(-2), { typed: "lean" });
      await logged(first, at(-1), { typed: "lean" });
      await logged(second, at(-3), { typed: "lean" });
      await logged(first, at(-2), { typed: "lean" }, "b1");
      expect(await recurring(second)).toEqual([]);
      expect(await recurring(first, NOW, ["b1"])).toEqual([]);
      expect((await recurring(first, NOW, ["main", "b1"])).map((r) => r.senseId)).toEqual([
        sense("main"),
      ]);
      await logged(second, at(-1), { typed: "lean" });
      expect((await recurring(second)).map((r) => r.times)).toEqual([2]);
    });

    it("appears in feedback on the answer that makes it recur, and in the bank, until resolved", async () => {
      const learner = user("flow");
      await save(learner, "main");
      const answer = (overrides: Partial<AnswerInput>, now: Date) =>
        mod.review.answerReview(learner, input(overrides), now);

      // Review 1: the authored spelling mistake, typed. Once is not evidence.
      const first = await answer({ answer: "realy" }, NOW);
      expect(first).toMatchObject({
        status: "recorded",
        feedback: { match: "mistake", evidence: null },
      });
      // Reviews 2 and 3 are correct; review 4 is "which is correct?" on the same mistake (b is wrong).
      await answer({ exerciseId: PREPOSITION, expectedReviews: 1, answer: "on" }, at(1));
      await answer({ exerciseId: MISTAKE_OF, expectedReviews: 2, answer: "a" }, at(4));
      const again = { exerciseId: `mistake:${SPELLING}`, expectedReviews: 3, answer: "b" };
      const evidence = {
        kind: "authored",
        wrong: "We realy on data.",
        right: "We rely on data.",
        why: "Rely is spelled with one l and no a.",
        times: 2,
      };
      expect(await answer(again, at(11))).toMatchObject({
        status: "recorded",
        feedback: { outcome: "incorrect", evidence },
      });
      // A retry is the same answer: the same evidence, not a third time.
      expect(await answer(again, at(11, 1))).toMatchObject({
        status: "duplicate",
        feedback: { evidence },
      });
      expect(await logs(learner)).toBe(4);

      const bankRow = async (now: Date) =>
        (await mod.bank.loadBankPage(learner, 1, now)).rows.find(
          (r) => r.senseId === sense("main"),
        );
      expect(await bankRow(at(11))).toMatchObject({ missed: 2, mistakes: [evidence] });

      // Two correct answers after it resolve it; the wrong answers still count as missed.
      expect((await answer({ expectedReviews: 4 }, at(12))).status).toBe("recorded");
      expect((await bankRow(at(12)))!.mistakes).toHaveLength(1);
      // Box 2 now: due three days later.
      const resolving = { exerciseId: PREPOSITION, expectedReviews: 5, answer: "on" };
      expect((await answer(resolving, at(15))).status).toBe("recorded");
      expect(await bankRow(at(15))).toMatchObject({ missed: 2, mistakes: [] });
    });
  });
});
