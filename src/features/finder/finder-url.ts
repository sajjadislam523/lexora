import "server-only";

import { redirect } from "next/navigation";

import {
  finderHref,
  hasFilters,
  isCanonicalFinderParams,
  parseFinderParams,
  type FinderState,
} from "@/language/filters";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The Finder state of a request to /explore or /finder. Anything but the canonical URL (unknown
 * parameters, invalid or repeated values, another order, `page=1`, enum spellings) redirects with
 * 307 to the canonical one, before anything renders.
 */
export function finderUrlState(basePath: "/explore" | "/finder", params: SearchParams) {
  const state = parseFinderParams(params);
  if (!isCanonicalFinderParams(params, state)) redirect(finderHref(basePath, state));
  return state;
}

/** Browse pages past the last one redirect to the last page. */
export function redirectPastLastPage(
  basePath: "/explore" | "/finder",
  state: FinderState,
  pages: number,
) {
  if (state.page > pages) redirect(finderHref(basePath, { ...state, page: pages }));
}

/** Filtered and paged views (not plain searches) are not indexed, and canonical to themselves. */
export function isFilteredView(state: FinderState) {
  return hasFilters(state.filters) || state.page > 1;
}
