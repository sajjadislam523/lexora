/**
 * Links into language pages, shared by search results and the pages themselves. Client-safe.
 */

/** The anchor of a sense on its item's page: `significant.notable` → `sense-notable`. */
export function senseAnchor(senseId: string) {
  return `sense-${senseId.slice(senseId.indexOf(".") + 1)}`;
}

/**
 * A language page, opened at one meaning when the item has several (a sense label marks those),
 * so a result about "significant — having a real effect" lands on that meaning.
 */
export function languageHref(slug: string, sense?: { id: string; label?: string }) {
  return sense?.label ? `/language/${slug}#${senseAnchor(sense.id)}` : `/language/${slug}`;
}
