"use server";

import { APIError } from "better-auth/api";
import { z } from "zod";

import { auth } from "@/server/auth/auth";

export type VerifyEmailResult = "verified" | "expired" | "invalid" | "unavailable";

const tokenSchema = z.string().min(1).max(4096);

/**
 * Verifies an email address with the token from a verification link. The page reads the token
 * from the URL fragment and posts it here, so it never appears in a request URL or a log.
 *
 * This only marks the address verified (Better Auth's verify-email, with
 * autoSignInAfterVerification off): it creates no session and sets no cookie, whoever opens the
 * link. Opening it again changes nothing.
 */
export async function verifyEmailAction(token: unknown): Promise<VerifyEmailResult> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return "invalid";
  try {
    await auth.api.verifyEmail({ query: { token: parsed.data } });
    return "verified";
  } catch (error) {
    if (error instanceof APIError) {
      return error.body?.code === "TOKEN_EXPIRED" ? "expired" : "invalid";
    }
    // The database or the server is unavailable: say so, without detail.
    console.error(
      "Email verification failed",
      error instanceof Error ? error.name : "unknown error",
    );
    return "unavailable";
  }
}
