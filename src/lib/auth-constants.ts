/**
 * Auth constants shared by the server config, session helpers and the proxy.
 * No secrets here — this module may be imported anywhere.
 */
export const AUTH_COOKIE_PREFIX = "lexora";

/**
 * Areas that require a signed-in user — personal learning. Keep in sync with the `matcher` in
 * src/proxy.ts (Next.js requires that matcher to be a static literal); a unit test enforces this.
 * Everything else is public: the landing page, /explore, /language/*, auth pages, /design-system.
 */
export const PROTECTED_ROUTES = [
  "/home",
  "/finder",
  "/bank",
  "/practice",
  "/writing",
  "/speaking",
  "/progress",
  "/settings",
] as const;

/**
 * Public discovery pages a visitor may be returned to after signing in or creating an account
 * (e.g. from the save gate on /language/significant).
 */
export const PUBLIC_RETURN_ROUTES = ["/explore", "/language"] as const;

export const DEFAULT_SIGNED_IN_PATH = "/home";
