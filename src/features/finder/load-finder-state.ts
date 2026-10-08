import "server-only";

import { languageSearch } from "@/language";
import { discoveryShowcase } from "@/language/showcase";

import type { FinderState } from "./finder-view";

/**
 * Runs the URL's query through the language engine for /explore and /finder. Both pages call
 * this, so visitors and learners get identical language knowledge for the same query.
 */
export async function loadFinderState(query: string): Promise<FinderState> {
  try {
    const response = query.trim() ? await languageSearch.search(query) : null;
    if (response) return { kind: "results", response };
    return { kind: "intro", showcase: await discoveryShowcase() };
  } catch (error) {
    // The query isn't logged: it can contain whatever a learner typed.
    console.error("Language search failed", error instanceof Error ? error.message : error);
    return { kind: "error" };
  }
}
