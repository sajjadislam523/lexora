import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://lexora@localhost:5432/lexora",
  BETTER_AUTH_SECRET: "x".repeat(32),
};
const resend = { RESEND_API_KEY: "re_test_key", EMAIL_FROM: "Lexora <account@lexora.app>" };

describe("server environment", () => {
  it("accepts a minimal development configuration and defaults the app URL", () => {
    const env = parseServerEnv({ ...base, NODE_ENV: "development" });
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.AI_PROVIDER).toBe("none");
  });

  it("never requires an AI key when AI is off", () => {
    expect(() => parseServerEnv({ ...base, AI_PROVIDER: "none" })).not.toThrow();
  });

  it("requires an AI key only for hosted providers", () => {
    expect(() => parseServerEnv({ ...base, AI_PROVIDER: "anthropic" })).toThrow(/AI_API_KEY/);
    expect(() => parseServerEnv({ ...base, AI_PROVIDER: "local" })).not.toThrow();
  });

  it("rejects short secrets and non-Postgres URLs", () => {
    expect(() => parseServerEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() => parseServerEnv({ ...base, DATABASE_URL: "mysql://x@y/z" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("requires an https app URL in production (localhost excepted)", () => {
    expect(() => parseServerEnv({ ...base, NODE_ENV: "production" })).toThrow(/BETTER_AUTH_URL/);
    expect(() =>
      parseServerEnv({ ...base, NODE_ENV: "production", BETTER_AUTH_URL: "http://lexora.app" }),
    ).toThrow(/https/);
    expect(() =>
      parseServerEnv({
        ...base,
        ...resend,
        NODE_ENV: "production",
        BETTER_AUTH_URL: "https://lexora.app",
      }),
    ).not.toThrow();
    expect(() =>
      parseServerEnv({
        ...base,
        ...resend,
        NODE_ENV: "production",
        BETTER_AUTH_URL: "http://localhost:3000",
      }),
    ).not.toThrow();
  });

  it("writes account email to the local outbox outside production", () => {
    for (const NODE_ENV of ["development", "test"]) {
      const env = parseServerEnv({ ...base, NODE_ENV });
      expect(env.EMAIL_TRANSPORT).toBe("outbox");
      expect(env.EMAIL_OUTBOX_DIR).toBe(".email-outbox");
    }
  });

  it("sends with Resend in production and fails loudly without its settings", () => {
    const production = { ...base, NODE_ENV: "production", BETTER_AUTH_URL: "https://lexora.app" };
    expect(() => parseServerEnv(production)).toThrow(/RESEND_API_KEY[\s\S]*EMAIL_FROM/);
    expect(() => parseServerEnv({ ...production, RESEND_API_KEY: "re_x" })).toThrow(/EMAIL_FROM/);
    expect(parseServerEnv({ ...production, ...resend }).EMAIL_TRANSPORT).toBe("resend");
    expect(() => parseServerEnv({ ...base, EMAIL_TRANSPORT: "resend" })).toThrow(/RESEND_API_KEY/);
  });

  it("allows the outbox in a production build only on localhost", () => {
    const outbox = { ...base, NODE_ENV: "production", EMAIL_TRANSPORT: "outbox" };
    expect(() =>
      parseServerEnv({ ...outbox, BETTER_AUTH_URL: "http://localhost:3000" }),
    ).not.toThrow();
    expect(() => parseServerEnv({ ...outbox, BETTER_AUTH_URL: "https://lexora.app" })).toThrow(
      /EMAIL_TRANSPORT/,
    );
  });

  it("never echoes secret values in errors", () => {
    const secret = "short-secret";
    try {
      parseServerEnv({ ...base, BETTER_AUTH_SECRET: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
    const key = "re_live_secret_value";
    try {
      parseServerEnv({ ...base, NODE_ENV: "production", RESEND_API_KEY: key });
    } catch (error) {
      expect(String(error)).not.toContain(key);
    }
  });
});
