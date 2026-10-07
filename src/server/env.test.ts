import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://lexora:lexora@localhost:5432/lexora",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

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
      parseServerEnv({ ...base, NODE_ENV: "production", BETTER_AUTH_URL: "https://lexora.app" }),
    ).not.toThrow();
    expect(() =>
      parseServerEnv({ ...base, NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3000" }),
    ).not.toThrow();
  });

  it("never echoes secret values in errors", () => {
    const secret = "short-secret";
    try {
      parseServerEnv({ ...base, BETTER_AUTH_SECRET: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
