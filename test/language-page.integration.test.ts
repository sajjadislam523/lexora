import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fixtureContent, sense, toFiles } from "./content-fixture";
import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * What /language/[slug] resolves to, against PostgreSQL: published items render, old and retired
 * slugs redirect permanently, drafts and unknown slugs are real 404s, and each meaning keeps its
 * own relations. Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

type Loader = typeof import("@/features/language/load-language-page").loadLanguagePage;
type Repository = import("@/server/repositories/language").DatabaseLanguageRepository;

/** The digest Next.js gives the error thrown by notFound() or permanentRedirect(). */
async function digestOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return (error as { digest?: string }).digest ?? String(error);
  }
  return "resolved";
}

describe.skipIf(!hasDatabase)("language pages", () => {
  let load: Loader;
  let open: (content: Awaited<ReturnType<typeof loadPublishedContent>>) => Promise<{
    repo: Repository;
    drop: () => Promise<void>;
  }>;

  beforeAll(async () => {
    load = (await import("@/features/language/load-language-page")).loadLanguagePage;
    const { importContent } = await import("@/server/content/import");
    const { DatabaseLanguageRepository } = await import("@/server/repositories/language");
    open = async (content) => {
      const temp = await createTempDatabase();
      await importContent(temp.db, content);
      return { repo: new DatabaseLanguageRepository(temp.db), drop: temp.drop };
    };
  });

  describe("publishing states", () => {
    let repo: Repository;
    let drop: () => Promise<void>;

    beforeAll(async () => {
      const { validateContent, formatIssue } = await import("@/server/content/validate");
      const content = fixtureContent();
      content.items.crucial!.slug = "crucial-adjective";
      content.items.crucial!.previous_slugs = ["crucial"];
      content.items.analyse!.status = "retired";
      content.items.analyse!.replaced_by = "crucial";
      content.items.however!.status = "retired";
      content.intents = {};
      sense(content, "important").relations = [
        {
          type: "stronger",
          to: "crucial.essential",
          note: "Crucial means an outcome depends on it.",
        },
      ];
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
      sense(content, "vital").standalone = "Draft for the test.";
      const result = validateContent(toFiles(content));
      if (!result.ok) throw new Error(result.issues.map(formatIssue).join("\n"));
      ({ repo, drop } = await open(result.content));
    });

    afterAll(async () => {
      await drop?.();
    });

    it("renders a published item", async () => {
      const item = await load(repo, "important");
      expect(item).toMatchObject({ id: "important", headword: "important" });
    });

    it("redirects an old slug permanently to the current one", async () => {
      expect(await digestOf(load(repo, "crucial"))).toMatch(
        /^NEXT_REDIRECT;\w+;\/language\/crucial-adjective;308;/,
      );
    });

    it("redirects a retired item permanently to its replacement", async () => {
      expect(await digestOf(load(repo, "analyse"))).toMatch(
        /^NEXT_REDIRECT;\w+;\/language\/crucial-adjective;308;/,
      );
    });

    it.each([
      ["a retired item without a replacement", "however"],
      ["a draft", "vital"],
      ["an unknown slug", "no-such-item"],
    ])("returns a real 404 for %s", async (_, slug) => {
      expect(await digestOf(load(repo, slug))).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
    });
  });

  describe("published content", () => {
    let repo: Repository;
    let drop: () => Promise<void>;

    beforeAll(async () => {
      ({ repo, drop } = await open(await loadPublishedContent()));
    });

    afterAll(async () => {
      await drop?.();
    });

    it("gives every published item a page", async () => {
      const slugs = await repo.listPublishedSlugs();
      expect(slugs).toHaveLength(40);
      for (const slug of slugs) {
        const item = await load(repo, slug);
        expect(item.slug).toBe(slug);
        expect(item.senses.length).toBeGreaterThan(0);
        for (const s of item.senses) expect(s.examples.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("keeps relations with the meaning they belong to", async () => {
      const significant = await load(repo, "significant");
      const [notable, statistical] = significant.senses;
      expect(notable!.relations.map((r) => r.headword)).toEqual(
        expect.arrayContaining(["considerable", "substantial", "crucial", "important"]),
      );
      expect(statistical!.relations).toEqual([]);

      const important = await load(repo, "important");
      const related = important.senses[0]!.relations;
      expect(related.map((r) => r.headword)).not.toContain("considerable");
      expect(related.find((r) => r.headword === "significant")).toMatchObject({
        type: "synonym",
        senseId: "significant.notable",
        senseLabel: "having a real effect",
      });
    });

    it("shows the preposition patterns and the mistake for responsible for", async () => {
      const item = await load(repo, "responsible-for");
      const duty = item.senses[0]!;
      expect(duty.prepositionPatterns.map((p) => p.pattern)).toEqual([
        "be responsible for + noun / -ing",
        "be responsible to + person / organisation",
      ]);
      expect(duty.mistakes.map((m) => [m.wrong, m.right])).toContainEqual([
        "responsible of",
        "responsible for",
      ]);
    });
  });
});
