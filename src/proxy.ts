import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_PREFIX } from "@/lib/auth-constants";

/**
 * Optimistic route protection: a fast cookie-presence check that redirects obviously signed-out
 * visitors before rendering. It does NOT validate the session — `requireSession()` in the (app)
 * layout and in every server action does that against the database.
 */
export function proxy(request: NextRequest) {
  const path = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (!getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", path);
    return NextResponse.redirect(signIn);
  }

  // Lets server components know the requested path (used for the post-sign-in redirect).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lexora-path", path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Must be a static literal (Next.js). Keep in sync with PROTECTED_ROUTES in src/lib/auth-constants.ts.
export const config = {
  matcher: [
    "/home/:path*",
    "/finder/:path*",
    "/bank/:path*",
    "/practice/:path*",
    "/writing/:path*",
    "/speaking/:path*",
    "/progress/:path*",
    "/settings/:path*",
    "/language/:path*",
  ],
};
