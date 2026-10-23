import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Home against PostgreSQL (Phase 5 Step 7; specification §18, D15): every number and row is the
 * learner's own — counts that match the bank, the next review, the latest saves with their real
 * status, and only recurring mistakes the learner actually made. Throwaway rows with unique IDs,
 * removed afterwards. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-02T12:00:00.000Z");
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

describe.skipIf(!hasDatabase)("home (PostgreSQL)", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    saved: typeof import("@/server/repositories/saved-senses");
    bank: typeof import("@/server/learning/bank");
    home: typeof import("@/server/learning/home");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-home-${run}`;
  const sense = (key: string) => `${itemId}.${key}`;
  const KEYS = ["a", "b", "c", "d", "e", "bare"] as const;
  const [alice, bob, carol, dave] = ["a", "b", "c", "d"].map((k) => `it-home-${k}-${run}`) as [
    string,
    string,
    string,
    string,
  ];
  let number = 0;

  async function save(
    userId: string,
    key: string,
    savedAt: Date,
    card?: { box: number; dueAt: Date },
  ) {
    const { db, schema } = mod;
    await db.insert(schema.savedSenses).values({ userId, senseId: sense(key), savedAt });
    if (card) {
      await db.insert(schema.reviewCards).values({
        userId,
        senseId: sense(key),
        box: card.box,
        reviews: card.box,
        lapses: 0,
        dueAt: card.dueAt,
      });
    }
  }
  /** One wrong answer that matched this sense's authored mistake, at a known time. */
  async function missed(userId: string, key: string, reviewedAt: Date) {
    await mod.db.insert(mod.schema.reviewLog).values({
      userId,
      cardId: "00000000-0000-4000-8000-000000000000",
      senseId: sense(key),
      reviewNumber: ++number,
      exerciseId: `mistake:${sense(key)}:m`,
      exerciseType: "mistake",
      outcome: "incorrect",
      answerMatch: "mistake",
      answer: null,
      expected: `right ${key}`,
      mistakeId: `${sense(key)}:m`,
      boxBefore: 1,
      boxAfter: 1,
      dueAfter: reviewedAt,
      reviewedAt,
    });
  }

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      saved: await import("@/server/repositories/saved-senses"),
      bank: await import("@/server/learning/bank"),
      home: await import("@/server/learning/home"),
    };
    const { db, schema } = mod;
    await db
      .insert(schema.users)
      .values(
        [alice, bob, carol, dave].map((id) => ({ id, name: "Home", email: `${id}@lexora.test` })),
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
      headword: `home-${run}`,
      normalized: `home-${run}`,
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
        definition: `Definition ${key}.`,
        partOfSpeech: "adjective" as const,
        cefr: "B2" as const,
        registers: ["neutral" as const],
        skills: ["writing" as const],
        ieltsRelevance: "core" as const,
        ieltsTasks: ["writing-2" as const],
        bestWhen: `Best when ${key}.`,
      })),
    );
    // Every sense but "bare" has one authored mistake, so it has an exercise.
    await db.insert(schema.mistakes).values(
      KEYS.filter((key) => key !== "bare").map((key) => ({
        id: `${sense(key)}:m`,
        senseId: sense(key),
        wrong: `wrong ${key}`,
        wrongNormalized: `wrong ${key}`,
        right: `right ${key}`,
        explanation: `Explanation ${key}.`,
        type: "grammar" as const,
        position: 0,
      })),
    );
  });

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob, carol, dave]));
    await db.delete(schema.mistakes).where(inArray(schema.mistakes.senseId, KEYS.map(sense)));
    await db.delete(schema.senses).where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.languageItems).where(eq(schema.languageItems.id, itemId));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
  });

  it("has nothing to show a learner who has saved nothing", async () => {
    expect(await mod.home.loadHome(carol, NOW)).toEqual({ kind: "empty" });
  });

  it("shows the learner's own counts, latest saves and recurring mistakes", async () => {
    await save(alice, "a", at(-30), { box: 4, dueAt: at(9) }); // known
    await save(alice, "b", at(-20), { box: 2, dueAt: at(-1) }); // due
    await save(alice, "c", at(-10)); // new, no card
    await save(alice, "bare", at(-5), { box: 1, dueAt: at(2) }); // learning, no exercise
    await save(alice, "d", at(-2), { box: 1, dueAt: at(1) }); // learning
    // Recurring: "a" twice (latest at -2), "b" twice (latest at -1); "d" only once.
    await missed(alice, "a", at(-6));
    await missed(alice, "a", at(-2));
    await missed(alice, "b", at(-4));
    await missed(alice, "b", at(-1));
    await missed(alice, "d", at(-1));

    const home = await mod.home.loadHome(alice, NOW);
    expect(home.kind).toBe("learner");
    if (home.kind !== "learner") return;

    const bankPage = await mod.bank.loadBankPage(alice, 1, NOW);
    expect(home.counts).toEqual(bankPage.counts);
    expect(home.counts.total).toBe(await mod.saved.countSavedSenses(alice));
    expect(home.ready).toBe(2); // b (due) and c (new)
    expect(home.nextReview).toBeNull(); // only given when nothing is ready

    expect(home.recent.map((r) => [r.senseLabel, r.status])).toEqual([
      ["d", "learning"],
      ["bare", "no_exercise"],
      ["c", "new"],
      ["b", "due"],
    ]);
    expect(home.recent[0]).toEqual({
      senseId: sense("d"),
      term: `home-${run}`,
      kind: "word",
      senseLabel: "d",
      context: "Best when d.",
      href: `/language/${itemId}#sense-d`,
      status: "learning",
    });

    expect(home.mistakes).toEqual([
      {
        kind: "authored",
        wrong: "wrong b",
        right: "right b",
        why: "Explanation b.",
        times: 2,
        term: `home-${run}`,
        href: `/language/${itemId}#sense-b`,
      },
      expect.objectContaining({ wrong: "wrong a", times: 2 }),
    ]);
  });

  it("names the next review when nothing is ready", async () => {
    await save(bob, "a", at(-30), { box: 3, dueAt: at(3) });
    await save(bob, "d", at(-20), { box: 2, dueAt: at(5) });
    const home = await mod.home.loadHome(bob, NOW);
    expect(home).toMatchObject({ kind: "learner", ready: 0, nextReview: { due: false, days: 3 } });
    // Saved senses with authored mistakes, but none made: no mistakes shown.
    expect(home.kind === "learner" && home.mistakes).toEqual([]);
  });

  it("shows at most three mistakes, and never another learner's", async () => {
    for (const key of ["a", "b", "c", "d", "e"]) {
      await save(dave, key, at(-30), { box: 1, dueAt: at(1) });
      await missed(dave, key, at(-3));
      await missed(dave, key, at(-2));
    }
    const home = await mod.home.loadHome(dave, NOW);
    expect(home.kind === "learner" && home.mistakes.map((m) => m.wrong)).toEqual([
      "wrong a",
      "wrong b",
      "wrong c",
    ]);
    // Bob saved "a" and "d" too, and Alice made mistakes on them: Bob sees none of them.
    const bobs = await mod.home.loadHome(bob, NOW);
    expect(bobs.kind === "learner" && bobs.mistakes).toEqual([]);
  });
});
