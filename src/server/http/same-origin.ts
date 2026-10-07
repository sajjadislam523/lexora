import "server-only";

import { serverEnv } from "@/server/env";

/**
 * Cross-site request forgery guard for cookie-authenticated route handlers (server actions get
 * this from Next.js; route handlers don't). Browsers always send `Origin` on PUT, POST and
 * DELETE, so a missing or foreign origin is rejected. The app origin is BETTER_AUTH_URL — the
 * same single origin Better Auth trusts.
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(serverEnv().BETTER_AUTH_URL).origin;
}
