import "server-only";

/**
 * Where Lexora is served from — the base URL for Better Auth, email links and canonical URLs, and
 * the origins that may make cookie-authenticated requests. It comes from configuration only,
 * never from a request, so no `Host` or `Origin` header can change it.
 *
 * - Vercel Preview (`VERCEL_ENV=preview`): Vercel's own addresses for this deployment —
 *   `VERCEL_BRANCH_URL` (stable per branch, preferred for links) and `VERCEL_URL` (this
 *   deployment). Vercel sets both, without a scheme. `BETTER_AUTH_URL` is ignored here, so a value
 *   shared with Production can never make a preview trust the production site.
 * - Everywhere else (Production, local, CI): `BETTER_AUTH_URL`, or localhost in development.
 *   Production never reads the Vercel addresses.
 */
export const LOCAL_APP_URL = "http://localhost:3000";

/** A bare hostname, as Vercel provides it: no scheme, port, path or credentials. */
const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export type AppUrls = {
  /** The base URL: links in email, canonical URLs, Better Auth's `baseURL`. */
  url: string;
  /** Every origin trusted for cookie-authenticated requests (CSRF checks). */
  origins: string[];
};

type Source = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  BETTER_AUTH_URL?: string;
};

/** Returns null for a preview without a usable Vercel address (the env schema reports it). */
export function resolveAppUrls(source: Source): AppUrls | null {
  if (source.VERCEL_ENV === "preview") {
    const hosts = [source.VERCEL_BRANCH_URL, source.VERCEL_URL].filter(
      (host): host is string => typeof host === "string" && HOSTNAME.test(host),
    );
    if (hosts.length === 0) return null;
    const origins = [...new Set(hosts.map((host) => `https://${host.toLowerCase()}`))];
    return { url: origins[0]!, origins };
  }
  const url = source.BETTER_AUTH_URL ?? LOCAL_APP_URL;
  return { url, origins: [new URL(url).origin] };
}
