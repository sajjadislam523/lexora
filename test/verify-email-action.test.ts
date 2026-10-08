import { APIError } from "better-auth/api";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The verification page's server action, with Better Auth replaced: how each outcome of
 * verify-email reaches the page — including a database outage, which must neither look like a
 * bad link nor log the token.
 */
const verifyEmail = vi.fn();
vi.mock("@/server/auth/auth", () => ({ auth: { api: { verifyEmail } } }));

const { verifyEmailAction } = await import("@/features/auth/actions");

const token = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImxlYXJuZXJAbGV4b3JhLnRlc3QifQ.signature";

afterEach(() => {
  verifyEmail.mockReset();
  vi.restoreAllMocks();
});

describe("verifyEmailAction", () => {
  it("passes the token to Better Auth and reports success", async () => {
    verifyEmail.mockResolvedValue({ status: true, user: null });
    expect(await verifyEmailAction(token)).toBe("verified");
    expect(verifyEmail).toHaveBeenCalledWith({ query: { token } });
  });

  it("tells an expired link from an invalid one", async () => {
    verifyEmail.mockRejectedValueOnce(
      APIError.from("UNAUTHORIZED", { code: "TOKEN_EXPIRED", message: "Token expired" }),
    );
    expect(await verifyEmailAction(token)).toBe("expired");
    verifyEmail.mockRejectedValueOnce(
      APIError.from("UNAUTHORIZED", { code: "INVALID_TOKEN", message: "Invalid token" }),
    );
    expect(await verifyEmailAction(token)).toBe("invalid");
  });

  it("reports an outage as unavailable and logs no token", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    verifyEmail.mockRejectedValue(
      Object.assign(new Error(`Failed query: select … params: ${token}`), {
        name: "DrizzleQueryError",
      }),
    );
    expect(await verifyEmailAction(token)).toBe("unavailable");
    expect(errors).toHaveBeenCalledOnce();
    expect(errors.mock.calls.flat().join(" ")).not.toContain(token);
  });

  it("never calls Better Auth with something that isn't a token", async () => {
    for (const bad of [undefined, "", 7, { token }, "x".repeat(5000)]) {
      expect(await verifyEmailAction(bad)).toBe("invalid");
    }
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
