import { randomBytes, randomUUID } from "node:crypto";

import { count, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { clearEmailsTo, emailsTo, linkIn, tokenIn, waitForEmail } from "./outbox";

/**
 * Email verification and password reset through the real Better Auth + Drizzle stack against
 * PostgreSQL, with email delivered to the outbox transport. Rate limits and origin checks are
 * off in the test environment; the end-to-end suite covers them against a production build.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);

describe.skipIf(!hasDatabase)("account email against PostgreSQL", () => {
  let mod: {
    auth: typeof import("@/server/auth/auth").auth;
    db: typeof import("@/server/db/client").db;
    schema: typeof import("@/server/db/schema");
    verifyEmailAction: typeof import("@/features/auth/actions").verifyEmailAction;
    createEmailVerificationToken: typeof import("better-auth/api").createEmailVerificationToken;
    env: ReturnType<typeof import("@/server/env").serverEnv>;
  };
  const created: string[] = [];
  /** Everything Lexora and Better Auth write to the console during a test. */
  let logged: string[] = [];

  beforeAll(async () => {
    mod = {
      auth: (await import("@/server/auth/auth")).auth,
      db: (await import("@/server/db/client")).db,
      schema: await import("@/server/db/schema"),
      verifyEmailAction: (await import("@/features/auth/actions")).verifyEmailAction,
      createEmailVerificationToken: (await import("better-auth/api")).createEmailVerificationToken,
      env: (await import("@/server/env")).serverEnv(),
    };
  });

  beforeEach(() => {
    logged = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(
          args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))).join(" "),
        );
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (!mod) return;
    for (const email of created) {
      await mod.db.delete(mod.schema.users).where(eq(mod.schema.users.email, email));
      await clearEmailsTo(email);
    }
    await mod.db.$client.end();
  });

  async function signUp() {
    const email = `it-mail-${randomUUID()}@lexora.test`;
    const password = randomBytes(12).toString("hex");
    created.push(email);
    const response = await mod.auth.api.signUpEmail({
      body: { name: "Mail Learner", email, password },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    return { email, password, headers: new Headers({ cookie }) };
  }

  async function userRow(email: string) {
    const [user] = await mod.db
      .select()
      .from(mod.schema.users)
      .where(eq(mod.schema.users.email, email));
    return user!;
  }

  async function sessionCount(userId: string) {
    const [row] = await mod.db
      .select({ n: count() })
      .from(mod.schema.sessions)
      .where(eq(mod.schema.sessions.userId, userId));
    return row!.n;
  }

  async function signIn(email: string, password: string) {
    const response = await mod.auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    return response.status === 200
      ? new Headers({ cookie: response.headers.get("set-cookie")!.split(";")[0]! })
      : null;
  }

  /** Nothing logged during the test may contain these values. */
  function expectNotLogged(...secrets: string[]) {
    for (const line of logged) for (const secret of secrets) expect(line).not.toContain(secret);
  }

  describe("email verification", () => {
    it("creates an unverified account and sends a verification link to its address", async () => {
      const { email, password } = await signUp();
      expect((await userRow(email)).emailVerified).toBe(false);

      const message = await waitForEmail(email);
      expect(message.subject).toBe("Verify your email for Lexora");
      expect(message.from).toBe(mod.env.EMAIL_FROM);
      const link = linkIn(message, "/verify-email");
      expect(link.origin).toBe(new URL(mod.env.BETTER_AUTH_URL).origin);
      // The token travels in the fragment, never in the path or query a server would log.
      expect(link.search).toBe("");
      expect(link.hash).toMatch(/^#token=/);
      // Nothing the sign-up form accepted (the name) appears in the email.
      expect(message.html).not.toContain("Mail Learner");
      expect(message.text).not.toContain("Mail Learner");
      expectNotLogged(tokenIn(link), password);
    });

    it("lets an unverified learner sign in and use their session", async () => {
      const { email, password } = await signUp();
      const headers = await signIn(email, password);
      expect(headers).not.toBeNull();
      const session = await mod.auth.api.getSession({ headers: headers! });
      expect(session?.user.email).toBe(email);
      expect(session?.user.emailVerified).toBe(false);
    });

    it("verifies the address without creating a session or setting a cookie", async () => {
      const { email } = await signUp();
      const user = await userRow(email);
      const token = tokenIn(linkIn(await waitForEmail(email), "/verify-email"));
      const before = await sessionCount(user.id);

      expect(await mod.verifyEmailAction(token)).toBe("verified");
      expect((await userRow(email)).emailVerified).toBe(true);
      expect(await sessionCount(user.id)).toBe(before);

      // Better Auth's endpoint itself, as a response: no cookie, no session material.
      const response = await mod.auth.api.verifyEmail({ query: { token }, asResponse: true });
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await response.json()).toEqual({ status: true, user: null });
      expect(await sessionCount(user.id)).toBe(before);
      expectNotLogged(token);
    });

    it("treats a reused link for a verified address as done, changing nothing", async () => {
      const { email } = await signUp();
      const user = await userRow(email);
      const token = tokenIn(linkIn(await waitForEmail(email), "/verify-email"));
      expect(await mod.verifyEmailAction(token)).toBe("verified");
      const sessions = await sessionCount(user.id);
      const updatedAt = (await userRow(email)).updatedAt;

      expect(await mod.verifyEmailAction(token)).toBe("verified");
      expect(await sessionCount(user.id)).toBe(sessions);
      expect((await userRow(email)).updatedAt).toEqual(updatedAt);
    });

    it("rejects invalid, tampered and malformed tokens", async () => {
      const { email } = await signUp();
      const token = tokenIn(linkIn(await waitForEmail(email), "/verify-email"));
      const tampered = `${token.slice(0, -2)}${token.endsWith("AA") ? "BB" : "AA"}`;

      for (const bad of ["not-a-token", tampered, "", 42, null, "x".repeat(5000)]) {
        expect(await mod.verifyEmailAction(bad)).toBe("invalid");
      }
      expect((await userRow(email)).emailVerified).toBe(false);
    });

    it("rejects an expired token", async () => {
      const { email } = await signUp();
      const expired = await mod.createEmailVerificationToken(
        mod.env.BETTER_AUTH_SECRET,
        email,
        undefined,
        -60,
      );
      expect(await mod.verifyEmailAction(expired)).toBe("expired");
      expect((await userRow(email)).emailVerified).toBe(false);
    });

    it("rejects a token signed with another secret", async () => {
      const { email } = await signUp();
      const forged = await mod.createEmailVerificationToken(
        randomBytes(32).toString("base64"),
        email,
      );
      expect(await mod.verifyEmailAction(forged)).toBe("invalid");
      expect((await userRow(email)).emailVerified).toBe(false);
    });

    it("sends a fresh link to the signed-in learner's own address only", async () => {
      const { email, headers } = await signUp();
      await waitForEmail(email);

      const response = await mod.auth.api.sendVerificationEmail({
        headers,
        body: { email },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: true });
      const second = tokenIn(linkIn(await waitForEmail(email, 2), "/verify-email"));

      // Another address, while signed in: refused, and nothing is sent there.
      const other = `it-mail-${randomUUID()}@lexora.test`;
      await expect(
        mod.auth.api.sendVerificationEmail({ headers, body: { email: other } }),
      ).rejects.toMatchObject({ body: { code: "EMAIL_MISMATCH" } });
      expect(await emailsTo(other)).toHaveLength(0);

      // The fresh link works; afterwards there is nothing left to verify.
      expect(await mod.verifyEmailAction(second)).toBe("verified");
      await expect(
        mod.auth.api.sendVerificationEmail({ headers, body: { email } }),
      ).rejects.toMatchObject({ body: { code: "EMAIL_ALREADY_VERIFIED" } });
    });

    it("refuses to send a verification email without a session", async () => {
      const { email } = await signUp();
      await waitForEmail(email);
      // (Over HTTP this is a 401; the end-to-end suite checks that.)
      await expect(mod.auth.api.sendVerificationEmail({ body: { email } })).rejects.toMatchObject({
        status: "UNAUTHORIZED",
        body: { code: "SIGN_IN_REQUIRED" },
      });
      expect(await emailsTo(email)).toHaveLength(1);
    });
  });

  describe("password reset", () => {
    async function requestReset(email: string) {
      const response = await mod.auth.api.requestPasswordReset({
        body: { email },
        asResponse: true,
      });
      return { status: response.status, body: await response.text() };
    }

    async function resetToken(email: string, nth = 1) {
      return tokenIn(linkIn(await waitForEmail(email, nth + 1), "/reset-password"));
    }

    it("answers the same for an existing and an unknown address, and mails only the account", async () => {
      const { email } = await signUp();
      await waitForEmail(email);
      const unknown = `it-nobody-${randomUUID()}@lexora.test`;

      const known = await requestReset(email);
      const missing = await requestReset(unknown);
      expect(known).toEqual(missing);
      expect(known.status).toBe(200);

      const message = await waitForEmail(email, 2);
      expect(message.subject).toBe("Reset your Lexora password");
      const link = linkIn(message, "/reset-password");
      expect(link.origin).toBe(new URL(mod.env.BETTER_AUTH_URL).origin);
      expect(link.search).toBe("");
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(await emailsTo(unknown)).toHaveLength(0);
      expectNotLogged(tokenIn(link));
    });

    it("stores only a hash of the reset token", async () => {
      const { email } = await signUp();
      const user = await userRow(email);
      await requestReset(email);
      const token = await resetToken(email);

      const rows = await mod.db
        .select()
        .from(mod.schema.verifications)
        .where(eq(mod.schema.verifications.value, user.id));
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it("sets a new password once, ends every session, and keeps the old password out", async () => {
      const { email, password, headers } = await signUp();
      const user = await userRow(email);
      const elsewhere = await signIn(email, password);
      await requestReset(email);
      const token = await resetToken(email);
      const newPassword = randomBytes(12).toString("hex");

      // Too short: refused before the token is used, so the link still works afterwards.
      await expect(
        mod.auth.api.resetPassword({ body: { token, newPassword: "short" } }),
      ).rejects.toMatchObject({ body: { code: "PASSWORD_TOO_SHORT" } });

      const response = await mod.auth.api.resetPassword({
        body: { token, newPassword },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toBeNull();
      const body = await response.text();
      expect(JSON.parse(body)).toEqual({ status: true });
      expect(body).not.toContain(token);

      // Every session that existed before the reset — on any device — is gone.
      expect(await mod.auth.api.getSession({ headers })).toBeNull();
      expect(await mod.auth.api.getSession({ headers: elsewhere! })).toBeNull();
      expect(await sessionCount(user.id)).toBe(0);

      expect(await signIn(email, password)).toBeNull();
      expect(await signIn(email, newPassword)).not.toBeNull();

      // Stored as a salted hash, like a sign-up password.
      const [account] = await mod.db
        .select()
        .from(mod.schema.accounts)
        .where(eq(mod.schema.accounts.userId, user.id));
      expect(account!.password).not.toContain(newPassword);
      expect(account!.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

      // The link is spent.
      await expect(
        mod.auth.api.resetPassword({
          body: { token, newPassword: randomBytes(12).toString("hex") },
        }),
      ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } });
      expect(await signIn(email, newPassword)).not.toBeNull();
      expectNotLogged(token, password, newPassword);
    });

    it("rejects an unknown token", async () => {
      await expect(
        mod.auth.api.resetPassword({
          body: { token: randomBytes(12).toString("hex"), newPassword: "a-new-password" },
        }),
      ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } });
    });

    it("rejects an expired token and leaves the password unchanged", async () => {
      const { email, password } = await signUp();
      const user = await userRow(email);
      await requestReset(email);
      const token = await resetToken(email);
      await mod.db
        .update(mod.schema.verifications)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(mod.schema.verifications.value, user.id));

      await expect(
        mod.auth.api.resetPassword({ body: { token, newPassword: "a-new-password" } }),
      ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } });
      expect(await signIn(email, password)).not.toBeNull();
    });

    it("issues reset links that last an hour", async () => {
      const { email } = await signUp();
      const user = await userRow(email);
      const start = Date.now();
      await requestReset(email);
      await resetToken(email);
      const [row] = await mod.db
        .select()
        .from(mod.schema.verifications)
        .where(eq(mod.schema.verifications.value, user.id));
      const lifetime = row!.expiresAt.getTime() - start;
      expect(lifetime).toBeGreaterThan(59 * 60_000);
      expect(lifetime).toBeLessThanOrEqual(61 * 60_000);
    });
  });
});
