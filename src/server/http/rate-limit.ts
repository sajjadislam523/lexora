import "server-only";

import { NextResponse } from "next/server";

import { countRequest, type LimitedAction } from "@/server/repositories/request-limits";

/**
 * Per-learner limits on state-changing requests (Phase 5 D17, specification §21): a fixed
 * one-minute window per learner and action, counted in PostgreSQL so every serverless instance
 * shares it. Anonymous public search is limited at the edge by Vercel Firewall, not here.
 */
export const RATE_LIMITS: Record<LimitedAction, number> = {
  // PUT / DELETE /api/bank/saved/[senseId]: saves and removals together.
  bank_write: 60,
  // The Phase 5 Step 5 review-answer endpoint, when it exists. Not wired to anything yet.
  review_answer: 30,
};

const WINDOW_MS = 60_000;

/** The start of the fixed window `now` falls in (the whole minute, UTC). */
export function windowStart(now: Date) {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}

/** Whole seconds until the window `now` falls in ends: at least 1, at most 60. */
export function retryAfterSeconds(now: Date) {
  const end = windowStart(now).getTime() + WINDOW_MS;
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000));
}

/**
 * Counts this request against the learner's limit for `action`. Returns `null` while the
 * learner is within it (the limit itself is allowed), or the 429 response to send. Call it only
 * after authenticating: the key is always the session's user, never anything from the request.
 */
export async function enforceRateLimit(
  userId: string,
  action: LimitedAction,
  now = new Date(),
): Promise<Response | null> {
  const count = await countRequest(userId, action, windowStart(now));
  if (count <= RATE_LIMITS[action]) return null;
  return NextResponse.json(
    { error: "rate_limited" },
    {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds(now)) },
    },
  );
}
