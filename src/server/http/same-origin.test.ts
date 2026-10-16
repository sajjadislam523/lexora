import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The cross-site check for cookie-authenticated route handlers trusts only the configured
 * origins (`APP_ORIGINS`). Nothing in the request — not `Host`, not forwarding headers — can add
 * to them.
 */
const PRODUCTION_URL = "https://lexora-five-sigma.vercel.app";
const BRANCH = "https://lexora-git-feature-team.vercel.app";
const DEPLOYMENT = "https://lexora-abc123-team.vercel.app";

async function checkerFor(env: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgres://lexora@localhost:5432/lexora");
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Lexora <account@lexora.app>");
  vi.stubEnv("BETTER_AUTH_URL", PRODUCTION_URL);
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return (await import("./same-origin")).isSameOrigin;
}

const request = (headers: Record<string, string>) =>
  new Request("https://whatever.example/api/bank/saved/x", { method: "PUT", headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSameOrigin", () => {
  it("accepts only the production origin in production", async () => {
    const isSameOrigin = await checkerFor({
      VERCEL_ENV: "production",
      VERCEL_URL: DEPLOYMENT.slice(8),
    });
    expect(isSameOrigin(request({ origin: PRODUCTION_URL }))).toBe(true);
    expect(isSameOrigin(request({ origin: DEPLOYMENT }))).toBe(false);
    expect(isSameOrigin(request({}))).toBe(false);
  });

  it("accepts the preview's own origins on a preview, and not production's", async () => {
    const isSameOrigin = await checkerFor({
      VERCEL_ENV: "preview",
      VERCEL_URL: DEPLOYMENT.slice(8),
      VERCEL_BRANCH_URL: BRANCH.slice(8),
    });
    expect(isSameOrigin(request({ origin: BRANCH }))).toBe(true);
    expect(isSameOrigin(request({ origin: DEPLOYMENT }))).toBe(true);
    expect(isSameOrigin(request({ origin: PRODUCTION_URL }))).toBe(false);
  });

  it("ignores the request's Host and forwarding headers", async () => {
    const isSameOrigin = await checkerFor({
      VERCEL_ENV: "preview",
      VERCEL_URL: DEPLOYMENT.slice(8),
    });
    const spoofed = request({
      origin: "https://evil.example",
      host: "evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    });
    expect(isSameOrigin(spoofed)).toBe(false);
    expect(
      isSameOrigin(request({ origin: "https://lexora-abc123-team.vercel.app.evil.example" })),
    ).toBe(false);
  });
});
