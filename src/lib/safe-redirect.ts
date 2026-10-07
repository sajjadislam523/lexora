import { DEFAULT_SIGNED_IN_PATH, PROTECTED_ROUTES, PUBLIC_RETURN_ROUTES } from "./auth-constants";

const PLACEHOLDER_ORIGIN = "http://lexora.invalid";

function isUnder(pathname: string, routes: readonly string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isProtectedPath(pathname: string) {
  return isUnder(pathname, PROTECTED_ROUTES);
}

/** Where a post-sign-in redirect may go: the app, or the public discovery page they came from. */
export function isReturnPath(pathname: string) {
  return isProtectedPath(pathname) || isUnder(pathname, PUBLIC_RETURN_ROUTES);
}

/**
 * Returns a safe post-sign-in destination. Only same-origin, relative paths inside the app or
 * the public discovery pages are allowed — anything else (absolute URLs, protocol-relative
 * `//evil.com`, backslash tricks, unknown paths) falls back to the default. Prevents open
 * redirects.
 */
export function safeRedirect(target: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH) {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(target, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN || !isReturnPath(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
