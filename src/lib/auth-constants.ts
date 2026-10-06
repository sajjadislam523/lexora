/**
 * Auth constants shared by the server config, session helpers and the proxy.
 * No secrets here — this module may be imported anywhere.
 */
export const AUTH_COOKIE_PREFIX = "lexora";

/**
 * Areas that require a signed-in user. Keep in sync with the `matcher` in src/proxy.ts
 * (Next.js requires that matcher to be a static literal); a unit test enforces this.
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
  "/language",
] as const;

export const DEFAULT_SIGNED_IN_PATH = "/home";
