import { DEFAULT_SIGNED_IN_PATH, PROTECTED_ROUTES } from "./auth-constants";

const PLACEHOLDER_ORIGIN = "http://lexora.invalid";

export function isProtectedPath(pathname: string) {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Returns a safe post-sign-in destination. Only same-origin, relative paths inside the app's
 * protected areas are allowed — anything else (absolute URLs, protocol-relative `//evil.com`,
 * backslash tricks, unknown paths) falls back to the default. Prevents open redirects.
 */
export function safeRedirect(target: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH) {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(target, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN || !isProtectedPath(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
