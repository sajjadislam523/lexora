import { describe, expect, it } from "vitest";

import { redactSessionTokens } from "./redact";

describe("redactSessionTokens", () => {
  it("removes a top-level token (sign-in / sign-up bodies)", () => {
    expect(redactSessionTokens({ token: "secret", user: { id: "u1" }, redirect: false })).toEqual({
      user: { id: "u1" },
      redirect: false,
    });
  });

  it("removes nested session tokens", () => {
    const body = { session: { id: "s1", token: "secret", userId: "u1" }, user: { id: "u1" } };
    expect(redactSessionTokens(body)).toEqual({
      session: { id: "s1", userId: "u1" },
      user: { id: "u1" },
    });
  });

  it("removes tokens from lists of session rows", () => {
    const rows = [
      { id: "s1", token: "a", userId: "u1", expiresAt: "2030-01-01" },
      { id: "s2", token: "b", userId: "u1", expiresAt: "2030-01-01" },
    ];
    expect(redactSessionTokens(rows)).toEqual([
      { id: "s1", userId: "u1", expiresAt: "2030-01-01" },
      { id: "s2", userId: "u1", expiresAt: "2030-01-01" },
    ]);
  });

  it("returns the same reference when there is nothing to remove", () => {
    const body = { status: true };
    const list = [{ id: "a1", providerId: "credential" }];
    expect(redactSessionTokens(body)).toBe(body);
    expect(redactSessionTokens(list)).toBe(list);
    expect(redactSessionTokens(null)).toBeNull();
  });
});
