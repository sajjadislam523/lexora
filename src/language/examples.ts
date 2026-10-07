/**
 * Client-safe search vocabulary: the search modes and the example searches people can try.
 * Holds no language content, so client components can import it without pulling the dataset
 * into the browser bundle. Searching itself happens on the server (src/language/index.ts).
 */
import { DEMO_QUERIES, FEATURED_QUERY_IDS, SEARCH_MODES } from "@/demo/finder";

import type { SearchMode } from "./types";

export { SEARCH_MODES };

export type ExampleSearch = { id: string; text: string; mode: SearchMode };

export const EXAMPLE_SEARCHES: ExampleSearch[] = DEMO_QUERIES.map(({ id, text, mode }) => ({
  id,
  text,
  mode,
}));

export const FEATURED_SEARCHES: ExampleSearch[] = FEATURED_QUERY_IDS.map((id) => {
  const search = EXAMPLE_SEARCHES.find((example) => example.id === id);
  if (!search) throw new Error(`Unknown featured search: ${id}`);
  return search;
});

/** The URL of a search on the Finder (`/finder`, signed in) or Explore (`/explore`, public). */
export function searchHref(basePath: "/finder" | "/explore", text: string) {
  const query = text.trim();
  return query ? `${basePath}?q=${encodeURIComponent(query)}` : basePath;
}
