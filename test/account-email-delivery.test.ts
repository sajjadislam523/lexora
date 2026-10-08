import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { EmailDeliveryError, OutboxEmailSender, ResendEmailSender } from "@/server/email/sender";
import { passwordResetEmail, verificationEmail } from "@/server/email/templates";

/**
 * Email delivery: the Resend client, the outbox, the templates, and what happens when the
 * provider fails — the account is kept, responses stay generic, and nothing secret is logged.
 * Every send in this file fails (the provider is replaced by one that always errors).
 */
vi.mock("@/server/email/sender", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/email/sender")>();
  return {
    ...actual,
    emailSender: () => ({
      send: async () => {
        throw new actual.EmailDeliveryError("Resend answered 500");
      },
    }),
  };
});

const message = {
  to: "learner@lexora.test",
  subject: "Verify your email for Lexora",
  text: "text body",
  html: "<p>html body</p>",
};

describe("Resend sender", () => {
  it("posts one message to Resend's API with the key as a bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await new ResendEmailSender("re_test_key", "Lexora <account@lexora.test>", fetchImpl).send(
      message,
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Lexora <account@lexora.test>",
      to: ["learner@lexora.test"],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  });

  it("reports a refusal by status only — no address, content or key", async () => {
    const fetchImpl = async () => new Response('{"message":"invalid"}', { status: 422 });
    const error = await new ResendEmailSender("re_test_key", "Lexora <a@b.c>", fetchImpl)
      .send(message)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe("Resend answered 422");
  });

  it("reports an unreachable provider without detail", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed: getaddrinfo learner@lexora.test");
    };
    const error = await new ResendEmailSender("re_test_key", "Lexora <a@b.c>", fetchImpl)
      .send(message)
      .catch((e: unknown) => e);
    expect((error as Error).message).toBe("Resend unreachable (TypeError)");
  });
});

describe("outbox sender", () => {
  it("writes each message as a private JSON file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "lexora-outbox-"));
    try {
      await new OutboxEmailSender(dir, "Lexora <account@lexora.test>").send(message);
      const [file] = await readdir(dir);
      const written = JSON.parse(await readFile(path.join(dir, file!), "utf8"));
      expect(written).toMatchObject({ from: "Lexora <account@lexora.test>", ...message });
      expect((await stat(path.join(dir, file!))).mode & 0o777).toBe(0o600);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("account email templates", () => {
  const url = "https://lexora.app/verify-email#token=abc.def";

  it("gives the link, how long it lasts, and what to do if it wasn't you", () => {
    const email = verificationEmail("learner@lexora.test", url, 60 * 60 * 24);
    expect(email.to).toBe("learner@lexora.test");
    expect(email.text).toContain(url);
    expect(email.html).toContain(`href="${url}"`);
    expect(email.text).toContain("This link works for 24 hours.");
    expect(email.text).toContain("If you didn’t create a Lexora account");
    expect(email.text).toContain("doesn’t sign anyone in");

    const reset = passwordResetEmail("learner@lexora.test", url, 60 * 60);
    expect(reset.text).toContain("This link works for 1 hour and can be used once.");
    expect(reset.text).toContain("you don’t need to do anything");
    expect(reset.text).not.toMatch(/compromis/i);
  });

  it("escapes the link in HTML", () => {
    const email = verificationEmail("a@b.c", 'https://lexora.app/x#token="><script>', 3600);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&quot;&gt;&lt;script&gt;");
  });
});

describe("when the email provider fails", () => {
  it("answers 503 with a generic message and logs only the cause", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sendEmailVerification } = await import("@/server/auth/emails");
    const token = randomBytes(16).toString("hex");

    const error = await sendEmailVerification("learner@lexora.test", token).catch((e) => e);
    expect(error).toMatchObject({ statusCode: 503, body: { code: "EMAIL_NOT_SENT" } });
    expect(JSON.stringify(error.body)).not.toContain(token);

    const lines = errors.mock.calls.map((call) => call.join(" "));
    expect(lines).toEqual(["Account email not sent (verification): Resend answered 500"]);
    errors.mockRestore();
  });

  const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);

  describe.skipIf(!hasDatabase)("against PostgreSQL", () => {
    const email = `it-nomail-${randomUUID()}@lexora.test`;
    const password = randomBytes(12).toString("hex");

    afterAll(async () => {
      const { db } = await import("@/server/db/client");
      const { users } = await import("@/server/db/schema");
      await db.delete(users).where(eq(users.email, email));
      await db.$client.end();
    });

    it("still creates the account and signs the learner in", async () => {
      const logged: string[] = [];
      const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
        logged.push(args.map(String).join(" "));
      });
      const { auth } = await import("@/server/auth/auth");

      const response = await auth.api.signUpEmail({
        body: { name: "No Mail", email, password },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toMatch(/lexora\.session_token=/);
      // The send runs after the response; give it a moment to fail and log.
      await new Promise((resolve) => setTimeout(resolve, 100));

      const session = await auth.api.getSession({
        headers: new Headers({ cookie: response.headers.get("set-cookie")!.split(";")[0]! }),
      });
      expect(session?.user).toMatchObject({ email, emailVerified: false });
      for (const line of logged) {
        expect(line).not.toContain(email);
        expect(line).not.toContain(password);
      }
      spy.mockRestore();
    });

    it("keeps the reset request answer generic", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { auth } = await import("@/server/auth/auth");
      const known = await auth.api.requestPasswordReset({ body: { email }, asResponse: true });
      const unknown = await auth.api.requestPasswordReset({
        body: { email: `it-nobody-${randomUUID()}@lexora.test` },
        asResponse: true,
      });
      expect(known.status).toBe(200);
      expect(await known.text()).toBe(await unknown.text());
      spy.mockRestore();
    });
  });
});
