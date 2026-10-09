"use client";

import { Analytics } from "@vercel/analytics/next";

import { sanitizeAnalyticsEvent } from "@/lib/analytics-privacy";

/**
 * Vercel Web Analytics: aggregate page views, no cookies. Mount only this wrapper, never
 * `@vercel/analytics` directly — it removes search text and link tokens from every event before
 * it leaves the browser (see `lib/analytics-privacy`).
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={sanitizeAnalyticsEvent} />;
}
