import { randomBytes, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Per-learner write limits (Phase 5 D17) against PostgreSQL: the counter itself, and the saved-
 * language endpoints that use it (60 saves and removals a minute). The clock is pinned with a
 * fake `Date` (timers stay real) so a burst never straddles a window. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
const APP_ORIGIN = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;

/** Thirty seconds into the current minute, so every request below stays in one window. */
function midWindow(offsetMinutes = 0) {
  const minute = Math.floor(Date.now() / 60_000) * 60_000;
  return new Date(minute + offsetMinutes * 60_000 + 30_000);
}

describe("windowStart and retryAfterSeconds", () => {
  it("uses whole UTC minutes and never asks to wait less than a second", async () => {
    const { retryAfterSeconds, windowStart } = await import("@/server/http/rate-limit");
    expect(windowStart(new Date("2026-10-22T10:15:42.250Z")).toISOString()).toBe(
      "2026-10-22T10:15:00.000Z",
    );
    expect(windowStart(new Date("2026-10-22T10:15:00.000Z")).toISOString()).toBe(
      "2026-10-22T10:15:00.000Z",
    );
    expect(retryAfterSeconds(new Date("2026-10-22T10:15:42.250Z"))).toBe(18);
    expect(retryAfterSeconds(new Date("2026-10-22T10:15:00.000Z"))).toBe(60);
    expect(retryAfterSeconds(new Date("2026-10-22T10:15:59.900Z"))).toBe(1);
  });
});

describe.skipIf(!hasDatabase)("per-learner write limits (PostgreSQL)", () => {
  let mod: {
    route: typeof import("@/app/api/bank/saved/[senseId]/route");
    limits: typeof import("@/server/repositories/request-limits");
    rateLimit: typeof import("@/server/http/rate-limit");
    auth: typeof import("@/server/auth/auth").auth;
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
  };
  const run = randomUUID().slice(0, 8);
  const emails = [`it-limit-a-${run}@lexora.test`, `it-limit-b-${run}@lexora.test`];
  const users = { alice: { id: "", cookie: "" }, bob: { id: "", cookie: "" } };

  beforeAll(async () => {
    mod = {
      route: await import("@/app/api/bank/saved/[senseId]/route"),
      limits: await import("@/server/repositories/request-limits"),
      rateLimit: await import("@/server/http/rate-limit"),
      auth: (await import("@/server/auth/auth")).auth,
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
    };
    for (const [key, email] of [
      ["alice", emails[0]!],
      ["bob", emails[1]!],
    ] as const) {
      const password = randomBytes(12).toString("hex");
      const signedUp = await mod.auth.api.signUpEmail({
        body: { name: "Limiter", email, password },
      });
      const response = await mod.auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      });
      users[key] = {
        id: signedUp.user.id,
        cookie: (response.headers.get("set-cookie") ?? "").split(";")[0]!,
      };
    }
  });

  afterEach(async () => {
    vi.useRealTimers();
    await mod.db
      .delete(mod.schema.requestLimits)
      .where(inArray(mod.schema.requestLimits.userId, [users.alice.id, users.bob.id]));
  });

  afterAll(async () => {
    await mod.db.delete(mod.schema.users).where(inArray(mod.schema.users.email, emails));
  });

  function call(
    method: "PUT" | "DELETE",
    options: { cookie?: string; senseId?: string; origin?: string; body?: string } = {},
  ) {
    const senseId = options.senseId ?? "significant.notable";
    const handler = method === "PUT" ? mod.route.PUT : mod.route.DELETE;
    return handler(
      new Request(`${APP_ORIGIN}/api/bank/saved/${encodeURIComponent(senseId)}`, {
        method,
        headers: {
          origin: options.origin ?? APP_ORIGIN,
          ...(options.cookie && { cookie: options.cookie }),
        },
        ...(options.body && { body: options.body }),
      }),
      { params: Promise.resolve({ senseId }) },
    );
  }

  describe("the counter", () => {
    it("counts within a window and starts again in the next", async () => {
      const { countRequest } = mod.limits;
      const now = midWindow();
      const window = mod.rateLimit.windowStart(now);
      expect(await countRequest(users.alice.id, "bank_write", window)).toBe(1);
      expect(await countRequest(users.alice.id, "bank_write", window)).toBe(2);
      expect(await countRequest(users.alice.id, "bank_write", window)).toBe(3);
      const next = mod.rateLimit.windowStart(midWindow(1));
      expect(await countRequest(users.alice.id, "bank_write", next)).toBe(1);
      // One row per learner per action, whatever the number of windows.
      const rows = await mod.db
        .select()
        .from(mod.schema.requestLimits)
        .where(eq(mod.schema.requestLimits.userId, users.alice.id));
      expect(rows).toHaveLength(1);
    });

    it("counts every one of many concurrent requests exactly once", async () => {
      const window = mod.rateLimit.windowStart(midWindow());
      const counts = await Promise.all(
        Array.from({ length: 70 }, () =>
          mod.limits.countRequest(users.alice.id, "bank_write", window),
        ),
      );
      expect([...counts].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 70 }, (_, i) => i + 1),
      );
    });

    it("keeps learners and actions apart", async () => {
      const window = mod.rateLimit.windowStart(midWindow());
      await mod.limits.countRequest(users.alice.id, "bank_write", window);
      await mod.limits.countRequest(users.alice.id, "bank_write", window);
      expect(await mod.limits.countRequest(users.bob.id, "bank_write", window)).toBe(1);
      expect(await mod.limits.countRequest(users.alice.id, "review_answer", window)).toBe(1);
    });
  });

  describe("the saved-language endpoints", () => {
    it("allow 60 saves and removals a minute, then answer 429", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: midWindow() });
      for (let i = 0; i < 60; i++) {
        const response = await call(i % 2 === 0 ? "PUT" : "DELETE", { cookie: users.alice.cookie });
        expect(response.status, `request ${i + 1}`).toBe(200);
      }
      const limited = await call("PUT", { cookie: users.alice.cookie });
      expect(limited.status).toBe(429);
      expect(await limited.json()).toEqual({ error: "rate_limited" });
      expect(limited.headers.get("retry-after")).toBe("30");
      expect(limited.headers.get("cache-control")).toBe("no-store");

      // The next window allows saving again.
      vi.setSystemTime(midWindow(1));
      expect((await call("DELETE", { cookie: users.alice.cookie })).status).toBe(200);
    });

    it("limit each learner by their own session, whatever the request says", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: midWindow() });
      const window = mod.rateLimit.windowStart(midWindow());
      for (let i = 0; i < 60; i++) {
        await mod.limits.countRequest(users.alice.id, "bank_write", window);
      }
      const body = JSON.stringify({ userId: users.bob.id });
      expect((await call("PUT", { cookie: users.alice.cookie, body })).status).toBe(429);
      // Bob's allowance is untouched by Alice's requests, including one naming him.
      expect((await call("PUT", { cookie: users.bob.cookie })).status).toBe(200);
      expect(await mod.limits.countRequest(users.bob.id, "bank_write", window)).toBe(2);
    });

    it("reject unauthenticated, cross-site and malformed requests before counting", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: midWindow() });
      const window = mod.rateLimit.windowStart(midWindow());
      for (let i = 0; i < 60; i++) {
        await mod.limits.countRequest(users.alice.id, "bank_write", window);
      }
      expect((await call("PUT")).status).toBe(401);
      expect(
        (await call("PUT", { cookie: users.alice.cookie, origin: "https://evil.example" })).status,
      ).toBe(403);
      expect(
        (await call("PUT", { cookie: users.alice.cookie, senseId: "not a sense" })).status,
      ).toBe(400);
      // None of those counted: the next well-formed request is the 61st.
      expect(await mod.limits.countRequest(users.alice.id, "bank_write", window)).toBe(61);
    });
  });
});
