import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The language bank against PostgreSQL (Phase 5 Step 4; specification §17): only the learner's
 * own saves, saves without a card read as new, statuses from the scheduler, the documented order,
 * counts that match the rows, retired senses and their replacement, pagination. Throwaway rows
 * with unique IDs, removed afterwards. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-02T12:00:00.000Z");
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

describe.skipIf(!hasDatabase)("language bank (PostgreSQL)", () => {
  let mod: {
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    saved: typeof import("@/server/repositories/saved-senses");
    cards: typeof import("@/server/repositories/review-cards");
    bank: typeof import("@/server/learning/bank");
  };
  const run = randomUUID().slice(0, 8);
  const sourceId = `it-source-${run}`;
  const itemId = `it-item-${run}`;
  const sense = (key: string) => `${itemId}.${key}`;
  const KEYS = ["due", "new", "old", "learning", "known", "bare", "retired", "next"] as const;
  const [alice, bob, carol] = ["a", "b", "c"].map((key) => `it-bank-${key}-${run}`) as [
    string,
    string,
    string,
  ];

  /** Saves a sense at a known time, with a card in the given state (or none). */
  async function saveAs(
    userId: string,
    key: (typeof KEYS)[number],
    savedAt: Date,
    card?: { box: number; reviews: number; dueAt: Date },
  ) {
    const { db, schema } = mod;
    await db.insert(schema.savedSenses).values({ userId, senseId: sense(key), savedAt });
    if (card) {
      await db.insert(schema.reviewCards).values({
        userId,
        senseId: sense(key),
        box: card.box,
        reviews: card.reviews,
        lapses: 0,
        dueAt: card.dueAt,
      });
    }
  }

  beforeAll(async () => {
    mod = {
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      saved: await import("@/server/repositories/saved-senses"),
      cards: await import("@/server/repositories/review-cards"),
      bank: await import("@/server/learning/bank"),
    };
    const { db, schema } = mod;
    await db
      .insert(schema.users)
      .values([alice, bob, carol].map((id) => ({ id, name: "Saver", email: `${id}@lexora.test` })));
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
    const base = {
      itemId,
      partOfSpeech: "adjective" as const,
      cefr: "B2" as const,
      registers: ["neutral" as const],
      skills: ["writing" as const],
      ieltsRelevance: "core" as const,
      ieltsTasks: ["writing-2" as const],
      bestWhen: "Testing.",
    };
    await db.insert(schema.senses).values(
      KEYS.map((key, position) => ({
        ...base,
        id: sense(key),
        position,
        label: key,
        definition: `Definition ${key}.`,
        ...(key === "retired" && { status: "retired" as const, replacedBy: sense("next") }),
      })),
    );
    // Every sense but "bare" has one authored mistake, so it has a review exercise.
    await db.insert(schema.mistakes).values(
      KEYS.filter((key) => key !== "bare").map((key, position) => ({
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
  });

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob, carol]));
    await db.delete(schema.mistakes).where(inArray(schema.mistakes.senseId, KEYS.map(sense)));
    await db
      .update(schema.senses)
      .set({ replacedBy: null })
      .where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.senses).where(eq(schema.senses.itemId, itemId));
    await db.delete(schema.languageItems).where(eq(schema.languageItems.id, itemId));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
  });

  it("is empty for a learner who has saved nothing", async () => {
    const page = await mod.bank.loadBankPage(carol, 1, NOW);
    expect(page).toEqual({
      counts: {
        total: 0,
        due: 0,
        new: 0,
        learning: 0,
        known: 0,
        retired: 0,
        filters: { all: 0, new: 0, learning: 0, known: 0, due: 0 },
      },
      filter: "all",
      page: 1,
      pages: 1,
      rows: [],
    });
  });

  it("lists the learner's saves by status, in the documented order", async () => {
    // Saved in a scrambled order, so the order below comes from the rules, not from inserts.
    await saveAs(alice, "known", at(-40), { box: 4, reviews: 4, dueAt: at(9) });
    await saveAs(alice, "new", at(-3), { box: 0, reviews: 0, dueAt: at(-3) });
    await saveAs(alice, "learning", at(-10), { box: 2, reviews: 2, dueAt: at(2) });
    await saveAs(alice, "due", at(-20), { box: 1, reviews: 1, dueAt: at(-1) });
    await saveAs(alice, "old", at(-5)); // saved before Phase 5: no card
    await saveAs(alice, "bare", at(-1), { box: 1, reviews: 1, dueAt: at(1) });
    await saveAs(alice, "retired", at(-30), { box: 3, reviews: 3, dueAt: at(4) });

    const page = await mod.bank.loadBankPage(alice, 1, NOW);
    expect(page.rows.map((row) => [row.senseLabel, row.status, row.nextReview])).toEqual([
      // Ready to review: reviewed cards that are due, then new ones, oldest save first.
      ["due", "due", { due: true }],
      ["old", "new", { due: true }],
      ["new", "new", { due: true }],
      // Coming up: by when they come back.
      ["bare", "no_exercise", { due: false, days: 1 }],
      ["learning", "learning", { due: false, days: 2 }],
      ["known", "known", { due: false, days: 9 }],
      // No longer reviewed.
      ["retired", "retired", null],
    ]);
    expect(page.rows.map((row) => mod.bank.bankSection(row.status))).toEqual([
      "ready",
      "ready",
      "ready",
      "coming",
      "coming",
      "coming",
      "retired",
    ]);
    expect(page.counts).toEqual({
      total: 7,
      due: 1,
      new: 2,
      learning: 2,
      known: 1,
      retired: 1,
      // By stage, whether due or not ("due", "learning" and "bare" are in box 1–3), and due with
      // the new ones; the retired sense is only under All.
      filters: { all: 7, new: 2, learning: 3, known: 1, due: 3 },
    });
  });

  it("reads a save without a card as new, due since it was saved, and creates nothing", async () => {
    const page = await mod.bank.loadBankPage(alice, 1, NOW);
    expect(page.rows.find((row) => row.senseLabel === "old")).toMatchObject({
      status: "new",
      nextReview: { due: true },
    });
    const cards = await mod.db
      .select()
      .from(mod.schema.reviewCards)
      .where(
        and(
          eq(mod.schema.reviewCards.userId, alice),
          eq(mod.schema.reviewCards.senseId, sense("old")),
        ),
      );
    expect(cards).toEqual([]);
  });

  it("shows what the row needs, and the replacement of a retired sense", async () => {
    const page = await mod.bank.loadBankPage(alice, 1, NOW);
    expect(page.rows.find((row) => row.senseLabel === "learning")).toEqual({
      senseId: sense("learning"),
      term: `term-${run}`,
      kind: "word",
      senseLabel: "learning",
      definition: "Definition learning.",
      href: `/language/${itemId}#sense-learning`,
      example: null,
      pattern: null,
      status: "learning",
      stage: "learning",
      due: false,
      // These fixture cards are written directly, with no answers in the log, so no evidence.
      reason: { code: "not_practised" },
      nextReview: { due: false, days: 2 },
      replacement: null,
      missed: null,
      mistakes: [],
    });
    expect(page.rows.find((row) => row.status === "retired")?.replacement).toEqual({
      term: `term-${run}`,
      senseLabel: "next",
      href: `/language/${itemId}#sense-next`,
    });
  });

  it("never shows one learner's saves to another", async () => {
    await saveAs(bob, "due", at(-2));
    const bobs = await mod.bank.loadBankPage(bob, 1, NOW);
    expect(bobs.rows.map((row) => row.senseId)).toEqual([sense("due")]);
    expect(bobs.counts.total).toBe(1);
    const alices = await mod.bank.loadBankPage(alice, 1, NOW);
    expect(alices.counts.total).toBe(7);
  });

  it("counts the same saves as the saved count", async () => {
    expect((await mod.bank.loadBankPage(alice, 1, NOW)).counts.total).toBe(
      await mod.saved.countSavedSenses(alice),
    );
  });

  it("pages through the same order", async () => {
    const all = await mod.cards.listBank(alice, NOW, { limit: 50, offset: 0 });
    const first = await mod.cards.listBank(alice, NOW, { limit: 3, offset: 0 });
    const second = await mod.cards.listBank(alice, NOW, { limit: 3, offset: 3 });
    const third = await mod.cards.listBank(alice, NOW, { limit: 3, offset: 6 });
    expect([...first, ...second, ...third].map((e) => e.senseId)).toEqual(
      all.map((e) => e.senseId),
    );
  });

  it("moves a card between sections as time passes, without any write", async () => {
    // Three days later, "bare" (due in 1) and "learning" (due in 2) have come due too, and join
    // "due" (overdue since yesterday) at the front, by when each became due.
    const later = await mod.bank.loadBankPage(alice, 1, at(3));
    expect(later.rows.slice(0, 3).map((row) => [row.senseLabel, row.status])).toEqual([
      ["due", "due"],
      ["bare", "no_exercise"],
      ["learning", "due"],
    ]);
    expect(later.counts).toMatchObject({ due: 3, learning: 0, known: 1 });
  });

  it("drops a removed save from the bank", async () => {
    await mod.saved.removeSavedSense(alice, sense("new"));
    const page = await mod.bank.loadBankPage(alice, 1, NOW);
    expect(page.rows.map((row) => row.senseLabel)).not.toContain("new");
    expect(page.counts.total).toBe(6);
  });
});
