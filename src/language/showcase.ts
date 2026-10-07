import "server-only";

import { CONTEXT_EXAMPLE } from "./examples";
import { languageSearch } from "./index";
import type { SearchResponse, SearchResult } from "./search/types";

/**
 * What Explore, the Finder and the landing page show before anyone searches. Every part is a real
 * search response from the engine, not separate showcase data.
 */

type Line = { text: string; highlight?: string };

export type DiscoveryShowcase = {
  /** The context tool's example sentence and the engine's verdicts for it. */
  context?: { sentence: string; response: SearchResponse };
  /** The same idea in writing and in speaking: furthermore and its natural spoken alternative. */
  skillPair?: { writing: Line; speaking: Line; note?: string };
  /** "better word for important": the landing page's showcase result. */
  synonyms?: SearchResponse;
};

function line(result: SearchResult | undefined): Line | undefined {
  if (!result?.example) return undefined;
  const span = result.example.highlights[0];
  return {
    text: result.example.text,
    ...(span && { highlight: result.example.text.slice(span.start, span.end) }),
  };
}

const first = (response: SearchResponse | null) => response?.groups[0]?.results[0];

export async function discoveryShowcase(
  include: { synonyms?: boolean } = {},
): Promise<DiscoveryShowcase> {
  const [context, written, spoken, synonyms] = await Promise.all([
    languageSearch.search(CONTEXT_EXAMPLE.text),
    languageSearch.search("furthermore"),
    languageSearch.search("natural speaking alternative to furthermore"),
    include.synonyms ? languageSearch.search("better word for important") : null,
  ]);

  const writing = line(first(written));
  const spokenResult = first(spoken);
  const speaking = line(spokenResult);
  const note = spoken?.guide?.rows.find((row) => row.term === spokenResult?.term)?.when;

  return {
    ...(context?.outcome === "results" && {
      context: { sentence: CONTEXT_EXAMPLE.text, response: context },
    }),
    ...(writing && speaking && { skillPair: { writing, speaking, ...(note && { note }) } }),
    ...(synonyms?.outcome === "results" && { synonyms }),
  };
}
