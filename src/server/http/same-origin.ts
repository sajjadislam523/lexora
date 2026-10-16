import "server-only";

import { serverEnv } from "@/server/env";

/**
 * Cross-site request forgery guard for cookie-authenticated route handlers (server actions get
 * this from Next.js; route handlers don't). Browsers always send `Origin` on PUT, POST and
 * DELETE, so a missing or foreign origin is rejected. The allowed origins come from configuration
 * (`APP_ORIGINS`: the app URL, plus the branch URL on Vercel Preview) — the same origins Better
 * Auth trusts. The request's own `Host` never counts.
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && serverEnv().APP_ORIGINS.includes(origin);
}
