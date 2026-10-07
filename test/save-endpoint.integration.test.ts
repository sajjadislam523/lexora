import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The save endpoint is the one account action reachable from public pages. It must authenticate
 * every request itself, refuse cross-site requests, and take identity only from the session.
 * Runs against PostgreSQL; skipped when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
const APP_ORIGIN = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;

describe.skipIf(!hasDatabase)("PUT/DELETE /api/bank/items/[slug]", () => {
  let mod: {
    route: typeof import("@/app/api/bank/items/[slug]/route");
    auth: typeof import("@/server/auth/auth").auth;
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
  };
  const email = `it-${randomUUID()}@lexora.test`;
  const password = randomBytes(12).toString("hex");
  let cookie = "";

  beforeAll(async () => {
    mod = {
      route: await import("@/app/api/bank/items/[slug]/route"),
      auth: (await import("@/server/auth/auth")).auth,
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
    };
    await mod.auth.api.signUpEmail({ body: { name: "Save Gate", email, password } });
    const response = await mod.auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    cookie = (response.headers.get("set-cookie") ?? "").split(";")[0]!;
    expect(cookie).toMatch(/session_token=/);
  });

  afterAll(async () => {
    if (!mod) return;
    await mod.db.delete(mod.schema.users).where(eq(mod.schema.users.email, email));
    await mod.db.$client.end();
  });

  function call(
    method: "PUT" | "DELETE",
    slug: string,
    { headers = {}, body }: { headers?: Record<string, string>; body?: string } = {},
  ) {
    const request = new Request(`${APP_ORIGIN}/api/bank/items/${slug}`, {
      method,
      headers,
      body,
    });
    const context = { params: Promise.resolve({ slug }) };
    return method === "PUT" ? mod.route.PUT(request, context) : mod.route.DELETE(request, context);
  }

  it("rejects a visitor without a session", async () => {
    const response = await call("PUT", "significant", { headers: { origin: APP_ORIGIN } });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
  });

  it("rejects a forged session cookie", async () => {
    const response = await call("PUT", "significant", {
      headers: { origin: APP_ORIGIN, cookie: "lexora.session_token=forged.value" },
    });
    expect(response.status).toBe(401);
  });

  it("rejects cross-site and origin-less requests, even with a valid session", async () => {
    const attempts: Record<string, string>[] = [
      { origin: "https://evil.example", cookie },
      { cookie },
    ];
    for (const headers of attempts) {
      const response = await call("PUT", "significant", { headers });
      expect(response.status).toBe(403);
    }
  });

  it("saves and removes for the signed-in learner", async () => {
    const saved = await call("PUT", "significant", { headers: { origin: APP_ORIGIN, cookie } });
    expect(saved.status).toBe(200);
    expect(saved.headers.get("cache-control")).toBe("no-store");
    expect(await saved.json()).toEqual({ slug: "significant", saved: true, stored: false });

    const removed = await call("DELETE", "significant", {
      headers: { origin: APP_ORIGIN, cookie },
    });
    expect(await removed.json()).toEqual({ slug: "significant", saved: false, stored: false });
  });

  it("ignores any identity the client supplies", async () => {
    const response = await call("PUT", "crucial", {
      headers: { origin: APP_ORIGIN, cookie, "x-user-id": "someone-else" },
      body: JSON.stringify({ userId: "someone-else" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slug: "crucial", saved: true, stored: false });
  });

  it("returns 404 for language that doesn't exist", async () => {
    const response = await call("PUT", "not-a-real-item", {
      headers: { origin: APP_ORIGIN, cookie },
    });
    expect(response.status).toBe(404);
  });

  it("rejects the session once it is revoked", async () => {
    await mod.auth.api.signOut({ headers: new Headers({ cookie }) });
    const response = await call("PUT", "significant", { headers: { origin: APP_ORIGIN, cookie } });
    expect(response.status).toBe(401);
  });
});
