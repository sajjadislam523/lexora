import { randomBytes, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The saved-language endpoints against PostgreSQL. They are the only way to save, and are
 * reachable from public pages, so each request must authenticate itself, refuse cross-site
 * requests, take the learner only from the session, accept only published senses, and touch
 * only the caller's own saves. Skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
const APP_ORIGIN = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;

describe.skipIf(!hasDatabase)("saved language API", () => {
  let mod: {
    one: typeof import("@/app/api/bank/saved/[senseId]/route");
    list: typeof import("@/app/api/bank/saved/route");
    auth: typeof import("@/server/auth/auth").auth;
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
  };
  const run = randomUUID().slice(0, 8);
  const learners = [`it-a-${run}@lexora.test`, `it-b-${run}@lexora.test`];
  let alice = "";
  let bob = "";
  // Throwaway content for states the real dataset doesn't have: a draft item, a retired sense.
  const sourceId = `it-source-${run}`;
  const draftItem = `it-draft-${run}`;
  const liveItem = `it-live-${run}`;

  beforeAll(async () => {
    mod = {
      one: await import("@/app/api/bank/saved/[senseId]/route"),
      list: await import("@/app/api/bank/saved/route"),
      auth: (await import("@/server/auth/auth")).auth,
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
    };
    const cookies: string[] = [];
    for (const email of learners) {
      const password = randomBytes(12).toString("hex");
      await mod.auth.api.signUpEmail({ body: { name: "Saver", email, password } });
      const response = await mod.auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      });
      cookies.push((response.headers.get("set-cookie") ?? "").split(";")[0]!);
    }
    [alice, bob] = cookies as [string, string];

    const { db, schema } = mod;
    await db.insert(schema.contentSources).values({
      id: sourceId,
      name: "Integration test",
      kind: "editorial",
      licence: "LicenseRef-Test",
      permittedUses: ["definitions"],
    });
    await db.insert(schema.languageItems).values(
      [
        { id: draftItem, status: "draft" as const },
        { id: liveItem, status: "published" as const },
      ].map(({ id, status }) => ({
        id,
        slug: id,
        kind: "word" as const,
        headword: id,
        normalized: id,
        status,
        sourceId,
        authoredBy: "test",
      })),
    );
    const sense = {
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
      { ...sense, id: `${draftItem}.main`, itemId: draftItem, position: 0 },
      { ...sense, id: `${liveItem}.old`, itemId: liveItem, position: 0, status: "retired" },
    ]);
  });

  afterAll(async () => {
    if (!mod) return;
    const { db, schema } = mod;
    await db.delete(schema.users).where(inArray(schema.users.email, learners));
    await db.delete(schema.senses).where(inArray(schema.senses.itemId, [draftItem, liveItem]));
    await db
      .delete(schema.languageItems)
      .where(inArray(schema.languageItems.id, [draftItem, liveItem]));
    await db.delete(schema.contentSources).where(eq(schema.contentSources.id, sourceId));
    await db.$client.end();
  });

  function call(
    method: "PUT" | "DELETE",
    senseId: string,
    {
      cookie,
      origin = APP_ORIGIN,
      body,
    }: { cookie?: string; origin?: string | null; body?: string } = {},
  ) {
    const headers: Record<string, string> = {};
    if (cookie) headers.cookie = cookie;
    if (origin) headers.origin = origin;
    const request = new Request(`${APP_ORIGIN}/api/bank/saved/${encodeURIComponent(senseId)}`, {
      method,
      headers,
      body,
    });
    const context = { params: Promise.resolve({ senseId }) };
    return method === "PUT" ? mod.one.PUT(request, context) : mod.one.DELETE(request, context);
  }

  async function savedFor(cookie: string | undefined, senses: string[]) {
    const request = new Request(`${APP_ORIGIN}/api/bank/saved?senses=${senses.join(",")}`, {
      headers: cookie ? { cookie } : {},
    });
    return mod.list.GET(request);
  }

  async function rowsFor(email: string) {
    const { db, schema } = mod;
    return db
      .select({ senseId: schema.savedSenses.senseId })
      .from(schema.savedSenses)
      .innerJoin(schema.users, eq(schema.users.id, schema.savedSenses.userId))
      .where(eq(schema.users.email, email));
  }

  describe("authentication", () => {
    it("rejects a visitor without a session", async () => {
      const response = await call("PUT", "significant.notable");
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthenticated" });
      expect((await savedFor(undefined, ["significant.notable"])).status).toBe(401);
    });

    it("rejects a forged session cookie", async () => {
      const response = await call("PUT", "significant.notable", {
        cookie: "lexora.session_token=forged.value",
      });
      expect(response.status).toBe(401);
    });

    it("rejects cross-site and origin-less writes, even with a valid session", async () => {
      expect(
        (
          await call("PUT", "significant.notable", {
            cookie: alice,
            origin: "https://evil.example",
          })
        ).status,
      ).toBe(403);
      expect(
        (await call("DELETE", "significant.notable", { cookie: alice, origin: null })).status,
      ).toBe(403);
      expect(await rowsFor(learners[0]!)).toEqual([]);
    });
  });

  describe("what can be saved", () => {
    it.each([
      ["a malformed ID", "Significant Notable", 400],
      ["an item slug instead of a sense", "significant", 400],
      ["an unknown sense", "no-such-item.main", 404],
      ["a sense of a draft item", `${draftItem}.main`, 404],
      ["a retired sense", `${liveItem}.old`, 404],
    ])("refuses %s", async (_, senseId, status) => {
      const response = await call("PUT", senseId, { cookie: alice });
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("refuses a malformed or oversized saved-state query", async () => {
      expect((await savedFor(alice, ["not a sense"])).status).toBe(400);
      const many = Array.from({ length: 61 }, (_, i) => `item-${i}.main`);
      expect((await savedFor(alice, many)).status).toBe(400);
    });

    it("left no records for the refused saves", async () => {
      expect(await rowsFor(learners[0]!)).toEqual([]);
    });
  });

  describe("saving and removing", () => {
    it("saves a published sense once, however often it's saved", async () => {
      for (let i = 0; i < 2; i++) {
        const response = await call("PUT", "significant.notable", { cookie: alice });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ senseId: "significant.notable", saved: true });
      }
      expect(await rowsFor(learners[0]!)).toEqual([{ senseId: "significant.notable" }]);
    });

    it("saves each meaning of a word separately", async () => {
      const both = ["significant.notable", "significant.statistical"];
      expect(await (await savedFor(alice, both)).json()).toEqual({
        saved: ["significant.notable"],
      });

      await call("PUT", "significant.statistical", { cookie: alice });
      expect(
        ((await (await savedFor(alice, both)).json()) as { saved: string[] }).saved.sort(),
      ).toEqual(both);

      const removed = await call("DELETE", "significant.notable", { cookie: alice });
      expect(await removed.json()).toEqual({ senseId: "significant.notable", saved: false });
      expect(await (await savedFor(alice, both)).json()).toEqual({
        saved: ["significant.statistical"],
      });
    });

    it("removes idempotently", async () => {
      for (let i = 0; i < 2; i++) {
        expect((await call("DELETE", "significant.notable", { cookie: alice })).status).toBe(200);
      }
    });

    it("ignores any identity the client supplies", async () => {
      const response = await call("PUT", "crucial.essential", {
        cookie: alice,
        body: JSON.stringify({ userId: "someone-else" }),
      });
      expect(response.status).toBe(200);
      expect(await rowsFor(learners[0]!)).toContainEqual({ senseId: "crucial.essential" });
    });
  });

  describe("ownership", () => {
    it("never shows one learner's saves to another", async () => {
      expect(
        await (await savedFor(bob, ["crucial.essential", "significant.statistical"])).json(),
      ).toEqual({
        saved: [],
      });
    });

    it("can't remove another learner's save", async () => {
      await call("DELETE", "crucial.essential", { cookie: bob });
      expect(await rowsFor(learners[0]!)).toContainEqual({ senseId: "crucial.essential" });
    });

    it("lets two learners save the same sense independently", async () => {
      await call("PUT", "crucial.essential", { cookie: bob });
      await call("DELETE", "crucial.essential", { cookie: alice });
      expect(await rowsFor(learners[1]!)).toEqual([{ senseId: "crucial.essential" }]);
      expect(await rowsFor(learners[0]!)).not.toContainEqual({ senseId: "crucial.essential" });
    });
  });

  it("rejects the session once it is revoked", async () => {
    await mod.auth.api.signOut({ headers: new Headers({ cookie: bob }) });
    expect((await call("PUT", "significant.notable", { cookie: bob })).status).toBe(401);
  });
});
