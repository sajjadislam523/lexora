/**
 * Text normalisation shared by the content importer (the `normalized` columns) and the search
 * service (queries), so a stored form and a typed query are compared on equal terms.
 */

/** Longest query the service reads; anything longer is cut, not rejected. */
export const MAX_QUERY_LENGTH = 200;

/** The single token every gap marker (`___`, `____`, `…`, `...`) becomes in a query. */
export const GAP_TOKEN = "___";

const GAP_MARKERS = /_{2,}|…|\.{3,}/g;

/**
 * Unicode NFKC, lower case, straight quotes; keep letters, digits, apostrophes, hyphens, `+`, `?`
 * and the gap token; collapse whitespace; cut at {@link MAX_QUERY_LENGTH}.
 *
 * - `"Responsible  for…"` → `"responsible for ___"` (as a query)
 * - `"What’s more,"` → `"what's more"`
 */
export function normaliseQuery(input: string) {
  return input
    .normalize("NFKC")
    .split(GAP_MARKERS)
    .map(clean)
    .join(` ${GAP_TOKEN} `)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

/**
 * Normalises authored text (headwords, forms, collocations, triggers) for storage. Gap markers
 * are display-only here ("There is growing concern about …"), so they are dropped.
 */
export function normaliseTerm(input: string) {
  return clean(input.normalize("NFKC").replace(GAP_MARKERS, " "));
}

function clean(input: string) {
  return input
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^\p{L}\p{N}'+?\s-]/gu, " ")
    .replace(/(^|\s)['-]+/g, "$1")
    .replace(/['-]+(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a normalised string. */
export function words(normalised: string) {
  return normalised ? normalised.split(" ") : [];
}
