import "server-only";

import { hasFilters, type FinderState as FinderUrlState } from "@/language/filters";
import { languageContent, languageSearch } from "@/language";
import { discoveryShowcase } from "@/language/showcase";

import type { FinderState } from "./finder-view";

/**
 * Runs the URL's state through the language engine for /explore and /finder. Both pages call
 * this, so visitors and learners get identical language for the same URL.
 *
 * - A query: the engine's answer, restricted by any filters (the reading never changes).
 * - Filters without a query: browsing, filtered and paged in the database.
 * - Neither: the introduction, with per-value counts for the filter row.
 */
export async function loadFinderState(url: FinderUrlState): Promise<FinderState> {
  try {
    if (url.q) {
      const response = await languageSearch.search(url.q, url.filters);
      if (response) return { kind: "results", response };
    }
    if (hasFilters(url.filters)) {
      return { kind: "browse", response: await languageSearch.browse(url.filters, url.page) };
    }
    const [showcase, counts] = await Promise.all([
      discoveryShowcase(),
      languageContent.filterCounts({}),
    ]);
    return { kind: "intro", showcase, counts };
  } catch (error) {
    // The query isn't logged: it can contain whatever a learner typed.
    console.error("Language search failed", error instanceof Error ? error.message : error);
    return { kind: "error" };
  }
}
