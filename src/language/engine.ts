import type { LanguageDetail, SenseSummary, SlugRedirect } from "./model";

/**
 * Read access to published language. The database implementation lives in
 * src/server/repositories/language; search logic is tested against an in-memory fake.
 * Implementations never return drafts or retired content, and hold no learner data.
 */
export interface LanguageContentRepository {
  /** A published item; for an old or retired slug, where it moved; otherwise null. */
  getItemBySlug(slug: string): Promise<LanguageDetail | SlugRedirect | null>;
  /** Slugs of every published item, for static pages and the sitemap. */
  listPublishedSlugs(): Promise<string[]>;
  /** Card-sized summaries of published senses, in the order asked for; unknown IDs are skipped. */
  getSenseSummaries(senseIds: readonly string[]): Promise<SenseSummary[]>;
}

export function isRedirect(value: LanguageDetail | SlugRedirect): value is SlugRedirect {
  return "redirectTo" in value;
}
