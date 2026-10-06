import "server-only";

import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { AUTH_COOKIE_PREFIX } from "@/lib/auth-constants";
import { safeRedirect } from "@/lib/safe-redirect";

import { auth } from "./auth";

/** The validated session for this request, or null. Deduplicated per request. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/**
 * Returns the session or redirects to sign-in. This is the authoritative check — the proxy only
 * looks for a cookie. Call it in every protected layout, page, server action and route handler.
 */
export async function requireSession() {
  const session = await getSession();
  if (session) return session;

  const requestHeaders = await headers();
  const params = new URLSearchParams({ next: safeRedirect(requestHeaders.get("x-lexora-path")) });
  // A cookie that no longer maps to a valid session means it expired or was revoked.
  if (getSessionCookie(requestHeaders, { cookiePrefix: AUTH_COOKIE_PREFIX })) {
    params.set("reason", "session-expired");
  }
  redirect(`/sign-in?${params.toString()}`);
}

/** The only user fields that may cross into client components. */
export type SafeUser = { id: string; name: string; email: string };

export function toSafeUser(user: { id: string; name: string; email: string }): SafeUser {
  return { id: user.id, name: user.name, email: user.email };
}
