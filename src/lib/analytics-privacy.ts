import type { BeforeSendEvent } from "@vercel/analytics/next";

/**
 * What Vercel Web Analytics may learn about a page view: the path, and nothing a learner typed.
 *
 * Query parameters are kept only on an allowlist of known, fixed values. Everything else is
 * dropped: `q` (search text on /explore and /finder), `next` (a return path that can itself carry
 * a search), and any parameter added later. The fragment is always dropped — password-reset and
 * verification links carry their tokens there. Only the analytics payload changes; the page's
 * own URL is untouched.
 */
const SAFE_PARAMS: Record<string, (value: string) => boolean> = {
  // /sign-in?reason=… — one of three fixed notices.
  reason: (value) => ["session-expired", "signed-out", "password-reset"].includes(value),
  // /practice?step=… — a question number.
  step: (value) => /^\d{1,2}$/.test(value),
};

const PLACEHOLDER_ORIGIN = "http://analytics.invalid";

/** The URL with learner input removed. Fails closed: if it can't be parsed, only the path survives. */
export function sanitizeAnalyticsUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return raw.split(/[?#]/)[0] ?? "";
  }

  const kept = new URLSearchParams();
  for (const [name, value] of url.searchParams) {
    if (SAFE_PARAMS[name]?.(value)) kept.append(name, value);
  }
  const query = kept.size > 0 ? `?${kept.toString()}` : "";
  const origin = url.origin === PLACEHOLDER_ORIGIN ? "" : url.origin;
  return `${origin}${url.pathname}${query}`;
}

/** Vercel Analytics' `beforeSend`: every page view and event is sent with a sanitized URL. */
export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: sanitizeAnalyticsUrl(event.url) };
}
