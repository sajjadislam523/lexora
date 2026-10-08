import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fixtureContent, sense, toFiles } from "./content-fixture";
import { createTempDatabase } from "./temp-database";

/**
 * The database language repository over imported fixture content: published language only,
 * old and retired slugs redirect, and relations never lead to hidden content.
 * Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("DatabaseLanguageRepository", () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let repo: import("@/language/engine").LanguageContentRepository;

  beforeAll(async () => {
    temp = await createTempDatabase();
    const { validateContent, formatIssue } = await import("@/server/content/validate");
    const { importContent } = await import("@/server/content/import");
    const { DatabaseLanguageRepository } = await import("@/server/repositories/language");

    const content = fixtureContent();
    // A renamed item, a retired item with a replacement, a retired sense and a draft.
    content.items.crucial!.slug = "crucial-adjective";
    content.items.crucial!.previous_slugs = ["crucial"];
    content.items.analyse!.status = "retired";
    content.items.analyse!.replaced_by = "crucial";
    (content.items.crucial!.senses as unknown[]).push({
      ...sense(content, "crucial"),
      key: "old",
      retired: true,
      replaced_by: "crucial.essential",
    });
    content.items.vital = {
      ...structuredClone(content.items.crucial!),
      id: "vital",
      headword: "vital",
      status: "draft",
      review: { author: "claude" },
      forms: [{ form: "vital", type: "lemma" }],
    };
    delete content.items.vital.slug;
    delete content.items.vital.previous_slugs;
    (content.items.vital.senses as Record<string, unknown>[]).splice(1);
    sense(content, "vital").standalone = "Draft for the test.";

    const result = validateContent(toFiles(content));
    if (!result.ok) throw new Error(result.issues.map(formatIssue).join("\n"));
    await importContent(temp.db, result.content);
    repo = new DatabaseLanguageRepository(temp.db);
  });

  afterAll(async () => {
    await temp?.drop();
  });

  it("returns a published item with its senses, children and relations", async () => {
    const item = await repo.getItemBySlug("important");
    expect(item).not.toBeNull();
    if (!item || "redirectTo" in item) throw new Error("expected an item");

    expect(item).toMatchObject({
      id: "important",
      kind: "word",
      headword: "important",
      forms: [{ form: "important", type: "lemma" }],
      source: { name: "Lexora editorial" },
    });
    const [main] = item.senses;
    expect(main).toMatchObject({
      id: "important.main",
      definition: "Having a great effect or value, or worth paying attention to.",
      registers: ["neutral"],
      strength: 1,
      prepositionPatterns: [{ id: "to", pattern: "important to + person" }],
      mistakes: [{ id: "for-me", type: "preposition" }],
      relations: [
        {
          type: "stronger",
          senseId: "crucial.essential",
          slug: "crucial-adjective",
          headword: "crucial",
          note: "Crucial means an outcome depends on it.",
          weight: 3,
        },
      ],
    });
    expect(main!.examples[1]).toEqual({
      id: "important.main:ex2",
      text: "My family is really important to me.",
      highlights: [{ start: 20, end: 35 }],
      skill: "speaking",
      prepositionPatternId: "to",
    });
  });

  it("includes the inverse of relations authored on the other side", async () => {
    const item = await repo.getItemBySlug("crucial-adjective");
    if (!item || "redirectTo" in item) throw new Error("expected an item");
    expect(item.senses.map((s) => s.id)).toEqual(["crucial.essential"]);
    expect(item.senses[0]!.relations).toEqual([
      expect.objectContaining({ type: "weaker", senseId: "important.main", slug: "important" }),
    ]);
  });

  it("redirects an old slug and a retired item to where they live now", async () => {
    expect(await repo.getItemBySlug("crucial")).toEqual({ redirectTo: "crucial-adjective" });
    expect(await repo.getItemBySlug("analyse")).toEqual({ redirectTo: "crucial-adjective" });
  });

  it("hides drafts and unknown slugs", async () => {
    expect(await repo.getItemBySlug("vital")).toBeNull();
    expect(await repo.getItemBySlug("no-such-item")).toBeNull();
  });

  it("lists only published slugs", async () => {
    expect(await repo.listPublishedSlugs()).toEqual(["crucial-adjective", "however", "important"]);
  });

  it("summarises published senses in the order asked for, skipping hidden ones", async () => {
    const summaries = await repo.getSenseSummaries([
      "crucial.essential",
      "important.main",
      "crucial.old",
      "vital.essential",
      "analyse.examine",
      "missing.sense",
    ]);
    expect(summaries.map((s) => s.senseId)).toEqual(["crucial.essential", "important.main"]);
    expect(summaries[0]).toMatchObject({
      slug: "crucial-adjective",
      headword: "crucial",
      kind: "word",
      strength: 3,
      collocations: ["play a crucial role"],
      example: { text: "Sleep is crucial to success." },
    });
    expect(summaries[1]).toMatchObject({ pattern: "important to + person" });
  });
});
