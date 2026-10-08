import { randomBytes, randomInt, randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clearEmailsTo, emailsTo, linkIn, tokenIn, waitForEmail } from "../test/outbox";

/**
 * Email verification and password reset over HTTP against a production build, with account
 * email delivered to the outbox transport (EMAIL_TRANSPORT=outbox), which this suite reads.
 * Rate limits and origin checks are live here (they are off in unit tests).
 *
 * Each scenario signs up from its own client address (`x-forwarded-for`, which the rate limiter
 * keys on), so the per-address limits on sign-up and email requests don't spill across
 * scenarios or other suites. Skipped against a remote server, whose outbox isn't readable here.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;
const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(ORIGIN);

type Client = { ip: string; email: string; password: string; cookie: string };

const clients: Client[] = [];
let sql: ReturnType<typeof postgres>;

/** A random address in the benchmarking range (RFC 2544, 198.18.0.0/15): 2^17 to choose from. */
const someIp = () => `198.${18 + randomInt(2)}.${randomInt(256)}.${randomInt(1, 255)}`;

function post(path: string, body: unknown, init: { ip: string; cookie?: string; origin?: string }) {
  return fetch(`${BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: init.origin ?? ORIGIN,
      "x-forwarded-for": init.ip,
      ...(init.cookie && { cookie: init.cookie }),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .filter((c) => c.includes("session_token"))
    .join("; ");
}

async function signUp(): Promise<Client & { body: string }> {
  const client = {
    ip: someIp(),
    email: `e2e-mail-${randomUUID()}@lexora.test`,
    password: randomBytes(12).toString("hex"),
    cookie: "",
  };
  const response = await post(
    "/sign-up/email",
    { name: "E2E Mail", email: client.email, password: client.password },
    client,
  );
  expect(response.status).toBe(200);
  client.cookie = sessionCookie(response);
  expect(client.cookie).toMatch(/session_token=/);
  clients.push(client);
  return { ...client, body: await response.text() };
}

async function signIn(client: Client, password = client.password) {
  const response = await post(
    "/sign-in/email",
    { email: client.email, password },
    { ip: someIp() },
  );
  return { status: response.status, cookie: sessionCookie(response), body: await response.text() };
}

async function session(cookie: string) {
  const response = await fetch(`${BASE_URL}/api/auth/get-session`, { headers: { cookie } });
  const text = await response.text();
  return { text, data: JSON.parse(text) as { user: { emailVerified: boolean } } | null };
}

async function page(path: string, cookie?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return {
    status: response.status,
    response,
    html: (await response.text()).replaceAll("<!-- -->", ""),
  };
}

const sessionsOf = async (email: string) =>
  (
    await sql`select count(*)::int as n from sessions s join users u on u.id = s.user_id where u.email = ${email}`
  )[0]!.n as number;

/** The session token is a cookie only: never in a JSON body browser code could read. */
function expectNoSessionMaterial(body: string, cookie: string) {
  const token = decodeURIComponent(cookie.split("=")[1] ?? "").split(".")[0]!;
  expect(token.length).toBeGreaterThan(10);
  expect(body).not.toContain(token);
  expect(body).not.toMatch(/"token"\s*:\s*"/);
}

describe.skipIf(!local)("account email", () => {
  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  });

  afterAll(async () => {
    const emails = clients.map((c) => c.email);
    if (emails.length) await sql`delete from users where email in ${sql(emails)}`;
    for (const email of emails) await clearEmailsTo(email);
    await sql.end();
  });

  describe("A: verification never blocks learning", () => {
    let learner: Client;

    it("creates the account, signs the learner in and sends a verification link", async () => {
      const created = await signUp();
      learner = created;
      expectNoSessionMaterial(created.body, created.cookie);
      expect(JSON.parse(created.body).user).toMatchObject({
        email: learner.email,
        emailVerified: false,
      });

      const link = linkIn(await waitForEmail(learner.email), "/verify-email");
      expect(link.origin).toBe(ORIGIN);
      expect(link.search).toBe("");
      expect(link.hash).toMatch(/^#token=/);
    });

    it("signs in again without verifying", async () => {
      const again = await signIn(learner);
      expect(again.status).toBe(200);
      expectNoSessionMaterial(again.body, again.cookie);
      const current = await session(again.cookie);
      expect(current.data?.user.emailVerified).toBe(false);
      expectNoSessionMaterial(current.text, again.cookie);
    });

    it("opens every personal area, searches and reads language", async () => {
      for (const path of [
        "/home",
        "/finder",
        "/bank",
        "/practice",
        "/writing",
        "/speaking",
        "/settings",
      ]) {
        expect((await page(path, learner.cookie)).status, path).toBe(200);
      }
      expect((await page("/finder?q=important", learner.cookie)).html).toContain("significant");
      expect((await page("/explore?q=important", learner.cookie)).status).toBe(200);
      expect((await page("/language/significant", learner.cookie)).status).toBe(200);
    });

    it("saves a sense", async () => {
      const response = await fetch(`${BASE_URL}/api/bank/saved/significant.notable`, {
        method: "PUT",
        headers: { origin: ORIGIN, cookie: learner.cookie },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ senseId: "significant.notable", saved: true });
    });

    it("reminds, without blocking, until the address is verified", async () => {
      expect((await page("/home", learner.cookie)).html).toContain(
        "Verify your email when it suits you",
      );
      expect((await page("/settings", learner.cookie)).html).toContain("Send verification email");
    });

    it("verifies through the link without signing anyone in", async () => {
      const token = tokenIn(linkIn(await waitForEmail(learner.email), "/verify-email"));
      const before = await sessionsOf(learner.email);

      // The page the email opens: the token is in the fragment, so the server never sees it.
      const opened = await page("/verify-email");
      expect(opened.status).toBe(200);
      expect(opened.html).toContain("Verifying your email");
      expect(opened.html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      expect(opened.response.headers.get("set-cookie")).toBeNull();

      // Better Auth's verification, which the page's server action calls.
      const verified = await fetch(
        `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        { redirect: "manual" },
      );
      expect(verified.status).toBe(200);
      expect(verified.headers.getSetCookie()).toEqual([]);
      expect(await verified.json()).toEqual({ status: true, user: null });
      expect(await sessionsOf(learner.email)).toBe(before);

      expect((await session(learner.cookie)).data?.user.emailVerified).toBe(true);
      expect((await page("/home", learner.cookie)).html).not.toContain(
        "Verify your email when it suits you",
      );
      const settings = (await page("/settings", learner.cookie)).html;
      expect(settings).toContain("Verified");
      expect(settings).not.toContain("Send verification email");

      // Opening the link again changes nothing and still signs no one in.
      const again = await fetch(
        `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      );
      expect(again.status).toBe(200);
      expect(again.headers.getSetCookie()).toEqual([]);
      expect(await sessionsOf(learner.email)).toBe(before);
    });

    it("rejects invalid verification tokens", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/verify-email?token=not-a-token`);
      expect(response.status).toBe(401);
      expect(response.headers.getSetCookie()).toEqual([]);
    });
  });

  describe("B: a new verification link, rate limited", () => {
    it("sends to the signed-in learner, refuses strangers and cross-site requests, and limits", async () => {
      const learner = await signUp();
      await waitForEmail(learner.email);

      // No session: refused (Lexora never mails an address on a stranger's request).
      const anonymous = await post(
        "/send-verification-email",
        { email: learner.email },
        {
          ip: someIp(),
        },
      );
      expect(anonymous.status).toBe(401);

      // From another site: refused by Better Auth's origin check.
      const crossSite = await post(
        "/send-verification-email",
        { email: learner.email },
        {
          ip: someIp(),
          cookie: learner.cookie,
          origin: "https://evil.example",
        },
      );
      expect(crossSite.status).toBe(403);
      expect(await emailsTo(learner.email)).toHaveLength(1);

      // Three a minute from one address, then 429.
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const response = await post("/send-verification-email", { email: learner.email }, learner);
        statuses.push(response.status);
        if (response.status === 200) expect(await response.json()).toEqual({ status: true });
      }
      expect(statuses).toEqual([200, 200, 200, 429]);

      const latest = await waitForEmail(learner.email, 4);
      expect(latest.subject).toBe("Verify your email for Lexora");
      expect((await session(learner.cookie)).data?.user.emailVerified).toBe(false);
    });
  });

  describe("C: password reset", () => {
    it("resets with the emailed link, ends every session, and swaps the passwords", async () => {
      const learner = await signUp();
      const other = await signIn(learner);
      expect(other.status).toBe(200);

      const known = await post("/request-password-reset", { email: learner.email }, learner);
      const unknown = await post(
        "/request-password-reset",
        { email: `e2e-nobody-${randomUUID()}@lexora.test` },
        { ip: someIp() },
      );
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(await known.text()).toBe(await unknown.text());

      const link = linkIn(await waitForEmail(learner.email, 2), "/reset-password");
      expect(link.origin).toBe(ORIGIN);
      expect(link.search).toBe("");
      const token = tokenIn(link);

      const opened = await page("/reset-password");
      expect(opened.status).toBe(200);
      expect(opened.html).toContain("Choose a new password");
      expect(opened.html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      expect(opened.response.headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin",
      );

      const newPassword = randomBytes(12).toString("hex");
      const reset = await post("/reset-password", { token, newPassword }, learner);
      expect(reset.status).toBe(200);
      expect(reset.headers.getSetCookie()).toEqual([]);
      const resetBody = await reset.text();
      expect(JSON.parse(resetBody)).toEqual({ status: true });
      expect(resetBody).not.toContain(token);

      // Every session from before the reset has ended — the sign-up one and the other device.
      expect((await session(learner.cookie)).data).toBeNull();
      expect((await session(other.cookie)).data).toBeNull();
      const home = await page("/home", learner.cookie);
      expect(home.status).toBe(307);
      expect(home.response.headers.get("location")).toContain("/sign-in");
      expect(await sessionsOf(learner.email)).toBe(0);

      expect((await signIn(learner)).status).toBe(401);
      const fresh = await signIn(learner, newPassword);
      expect(fresh.status).toBe(200);
      expect((await session(fresh.cookie)).data).not.toBeNull();

      // The link is spent.
      const reused = await post(
        "/reset-password",
        { token, newPassword: "another-password" },
        {
          ip: someIp(),
        },
      );
      expect(reused.status).toBe(400);
      expect(await reused.json()).toMatchObject({ code: "INVALID_TOKEN" });
      expect((await signIn(learner, newPassword)).status).toBe(200);
    });

    it("shows the sign-in page's confirmation after a reset", async () => {
      const signIn = await page("/sign-in?reason=password-reset");
      expect(signIn.html).toContain("Your password has been changed");
      expect(signIn.html).toContain('href="/forgot-password"');
      expect((await page("/forgot-password")).html).toContain("Send reset link");
    });
  });

  describe("D: unusable reset links fail safely", () => {
    it("rejects unknown, expired and cross-site resets, and keeps the password", async () => {
      const learner = await signUp();
      const ip = someIp();

      const unknown = await post(
        "/reset-password",
        { token: randomBytes(12).toString("hex"), newPassword: "a-new-password" },
        { ip },
      );
      expect(unknown.status).toBe(400);
      expect(await unknown.json()).toMatchObject({ code: "INVALID_TOKEN" });

      await post("/request-password-reset", { email: learner.email }, learner);
      const token = tokenIn(linkIn(await waitForEmail(learner.email, 2), "/reset-password"));

      const crossSite = await post(
        "/reset-password",
        { token, newPassword: "a-new-password" },
        { ip, origin: "https://evil.example" },
      );
      expect(crossSite.status).toBe(403);

      await sql`update verifications set expires_at = now() - interval '1 minute'
        where value = (select id from users where email = ${learner.email})`;
      const expired = await post(
        "/reset-password",
        { token, newPassword: "a-new-password" },
        {
          ip,
        },
      );
      expect(expired.status).toBe(400);
      expect(await expired.json()).toMatchObject({ code: "INVALID_TOKEN" });

      expect((await signIn(learner)).status).toBe(200);
    });

    it("rate-limits reset requests from one address", async () => {
      const ip = someIp();
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const response = await post(
          "/request-password-reset",
          { email: `e2e-nobody-${randomUUID()}@lexora.test` },
          { ip },
        );
        statuses.push(response.status);
      }
      expect(statuses).toEqual([200, 200, 200, 429]);
    });

    it("refuses a reset request from another site, or with no origin", async () => {
      const crossSite = await post(
        "/request-password-reset",
        { email: `e2e-nobody-${randomUUID()}@lexora.test` },
        { ip: someIp(), origin: "https://evil.example" },
      );
      expect(crossSite.status).toBe(403);
      expect(await crossSite.json()).toMatchObject({ code: "INVALID_ORIGIN" });

      const noOrigin = await fetch(`${BASE_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": someIp() },
        body: JSON.stringify({ email: `e2e-nobody-${randomUUID()}@lexora.test` }),
      });
      expect(noOrigin.status).toBe(403);
    });
  });
});
