import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real Better Auth + Drizzle stack against PostgreSQL. Skipped when no database is
 * configured. Uses unique throwaway accounts and deletes them afterwards.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);

describe.skipIf(!hasDatabase)("authentication against PostgreSQL", () => {
  let mod: {
    auth: typeof import("@/server/auth/auth").auth;
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    profiles: typeof import("@/server/repositories/learner-profile");
  };
  const email = `it-${randomUUID()}@lexora.test`;
  const otherEmail = `it-${randomUUID()}@lexora.test`;
  const password = randomBytes(12).toString("hex");

  beforeAll(async () => {
    mod = {
      auth: (await import("@/server/auth/auth")).auth,
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      profiles: await import("@/server/repositories/learner-profile"),
    };
  });

  afterAll(async () => {
    if (!mod) return;
    for (const address of [email, otherEmail]) {
      await mod.db.delete(mod.schema.users).where(eq(mod.schema.users.email, address));
    }
    await mod.db.$client.end();
  });

  async function signInCookie(address: string, secret: string) {
    const response = await mod.auth.api.signInEmail({
      body: { email: address, password: secret },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    return new Headers({ cookie: setCookie.split(";")[0]! });
  }

  it("signs up and stores only a salted password hash", async () => {
    const result = await mod.auth.api.signUpEmail({
      body: { name: "Integration Learner", email, password },
    });
    expect(result.user.email).toBe(email);
    expect(result).not.toHaveProperty("token");

    const [account] = await mod.db
      .select()
      .from(mod.schema.accounts)
      .where(eq(mod.schema.accounts.userId, result.user.id));
    expect(account?.providerId).toBe("credential");
    expect(account?.password).not.toContain(password);
    expect(account?.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it("rejects a duplicate sign-up and a wrong password", async () => {
    await expect(
      mod.auth.api.signUpEmail({ body: { name: "Again", email, password } }),
    ).rejects.toThrow();
    await expect(
      mod.auth.api.signInEmail({ body: { email, password: `wrong-${password}` } }),
    ).rejects.toThrow();
  });

  it("issues a database session, hides its token, and revokes it on sign-out", async () => {
    const headers = await signInCookie(email, password);

    const session = await mod.auth.api.getSession({ headers });
    expect(session?.user.email).toBe(email);
    expect(session?.session).not.toHaveProperty("token");

    await mod.auth.api.signOut({ headers });
    expect(await mod.auth.api.getSession({ headers })).toBeNull();
  });

  it("never returns session tokens or password hashes in JSON responses", async () => {
    const signIn = await mod.auth.api.signInEmail({ body: { email, password }, asResponse: true });
    const body = (await signIn.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toMatch(/password/i);
    expect(signIn.headers.get("set-cookie")).toMatch(/lexora\.session_token=/);

    const headers = new Headers({
      cookie: (signIn.headers.get("set-cookie") ?? "").split(";")[0]!,
    });
    expect((await mod.auth.api.getSession({ headers }))?.user.email).toBe(email);

    const sessions = await mod.auth.api.listSessions({ headers, asResponse: true });
    const sessionRows = (await sessions.json()) as Record<string, unknown>[];
    expect(sessionRows.length).toBeGreaterThan(0);
    for (const row of sessionRows) expect(row).not.toHaveProperty("token");

    const accounts = await mod.auth.api.listUserAccounts({ headers, asResponse: true });
    const accountRows = (await accounts.json()) as Record<string, unknown>[];
    for (const row of accountRows) {
      expect(row).not.toHaveProperty("password");
      expect(row).not.toHaveProperty("accessToken");
    }

    await mod.auth.api.signOut({ headers });
  });

  it("returns a generic error for a wrong password", async () => {
    const response = await mod.auth.api.signInEmail({
      body: { email, password: `wrong-${password}` },
      asResponse: true,
    });
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).toContain("Invalid email or password");
    expect(text).not.toContain(email);
  });

  it("rejects a forged session cookie", async () => {
    const forged = new Headers({ cookie: "lexora.session_token=forged.value" });
    expect(await mod.auth.api.getSession({ headers: forged })).toBeNull();
  });

  it("keeps learner profiles per user and removes them with the user", async () => {
    const other = await mod.auth.api.signUpEmail({
      body: { name: "Other", email: otherEmail, password },
    });
    const [user] = await mod.db
      .select()
      .from(mod.schema.users)
      .where(eq(mod.schema.users.email, email));

    await mod.profiles.upsertLearnerProfile(user!.id, {
      targetBand: "7.0",
      testDate: null,
      focusSkill: "writing",
    });
    await mod.profiles.upsertLearnerProfile(user!.id, {
      targetBand: "7.5",
      testDate: "2027-03-14",
      focusSkill: "both",
    });
    await mod.profiles.upsertLearnerProfile(other.user.id, {
      targetBand: "6.0",
      testDate: null,
      focusSkill: null,
    });

    expect((await mod.profiles.getLearnerProfile(user!.id))?.targetBand).toBe("7.5");
    expect((await mod.profiles.getLearnerProfile(other.user.id))?.targetBand).toBe("6.0");

    await mod.db.delete(mod.schema.users).where(eq(mod.schema.users.id, other.user.id));
    expect(await mod.profiles.getLearnerProfile(other.user.id)).toBeNull();
  });

  it("enforces the target band range in the database", async () => {
    const [user] = await mod.db
      .select()
      .from(mod.schema.users)
      .where(eq(mod.schema.users.email, email));
    await expect(
      mod.profiles.upsertLearnerProfile(user!.id, {
        targetBand: "9.5",
        testDate: null,
        focusSkill: null,
      }),
    ).rejects.toThrow();
  });
});
