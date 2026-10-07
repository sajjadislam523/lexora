/**
 * Client-safe search vocabulary: the search modes, the example searches people can try, and
 * search URLs. Holds no language content — results always come from the search service on the
 * server (src/language/index.ts) — so client components can import it freely.
 */
import type { QueryIntent, SearchResponse } from "./search/types";

export const SEARCH_MODES = [
  { id: "word", label: "Word", placeholder: "better word for important" },
  { id: "phrase", label: "Phrase", placeholder: "phrase for giving an example" },
  { id: "preposition", label: "Preposition", placeholder: "preposition after responsible" },
  {
    id: "collocation",
    label: "Collocation",
    placeholder: "collocations with significant",
  },
  { id: "linker", label: "Linker", placeholder: "alternative to however" },
  {
    id: "expression",
    label: "Expression",
    placeholder: "natural speaking alternative to furthermore",
  },
  {
    id: "context",
    label: "Context",
    placeholder: "Governments should ___ more money to public transport",
  },
] as const;

export type SearchMode = (typeof SEARCH_MODES)[number]["id"];

export type ExampleSearch = { id: string; text: string; mode: SearchMode };

/** Searches that show what Lexora can do. Each is covered by the golden search suite. */
export const EXAMPLE_SEARCHES: ExampleSearch[] = [
  { id: "furthermore", text: "natural speaking alternative to furthermore", mode: "expression" },
  { id: "responsible", text: "preposition after responsible", mode: "preposition" },
  { id: "however", text: "alternative to however", mode: "linker" },
  { id: "contrast", text: "I want to express contrast", mode: "linker" },
  { id: "example", text: "phrase for giving an example", mode: "phrase" },
  { id: "important", text: "better word for important", mode: "word" },
  { id: "significant", text: "collocations with significant", mode: "collocation" },
  { id: "increase", text: "I want to say something increased significantly", mode: "expression" },
  { id: "serious-problem", text: "phrase for causing a serious problem", mode: "phrase" },
  { id: "context", text: "Governments should ___ more money to public transport", mode: "context" },
];

/** The six example searches shown first (Finder, Explore and the landing page). */
const FEATURED_IDS = [
  "important",
  "responsible",
  "however",
  "contrast",
  "furthermore",
  "serious-problem",
];

export const FEATURED_SEARCHES: ExampleSearch[] = FEATURED_IDS.map((id) => {
  const search = EXAMPLE_SEARCHES.find((example) => example.id === id);
  if (!search) throw new Error(`Unknown featured search: ${id}`);
  return search;
});

/** The example sentence the context tool demonstrates before anyone searches. */
export const CONTEXT_EXAMPLE = EXAMPLE_SEARCHES.find((example) => example.id === "context")!;

/** The URL of a search on the Finder (`/finder`, signed in) or Explore (`/explore`, public). */
export function searchHref(basePath: "/finder" | "/explore", text: string) {
  const query = text.trim();
  return query ? `${basePath}?q=${encodeURIComponent(query)}` : basePath;
}

const MODE_BY_INTENT: Partial<Record<QueryIntent, SearchMode>> = {
  SYNONYM: "word",
  STRONGER_ALTERNATIVE: "word",
  WEAKER_ALTERNATIVE: "word",
  PREPOSITION: "preposition",
  COLLOCATION: "collocation",
  LINKER: "linker",
  PHRASE: "phrase",
  SENTENCE_PATTERN: "phrase",
  CONTEXTUAL_EXPRESSION: "expression",
  CONTEXT_GAP: "context",
};

/**
 * The "Search as" chip that matches how the engine read the query, so a recognised query
 * highlights its mode. Only selects a chip; it never changes the results.
 */
export function modeForResponse(response: SearchResponse): SearchMode | null {
  const { intent, modifiers } = response.interpretation;
  const byIntent = MODE_BY_INTENT[intent];
  if (byIntent) return byIntent;
  const kind = response.groups[0]?.results[0]?.kind;
  if (intent === "ALTERNATIVE") {
    if (modifiers.some((m) => m === "speaking" || m === "natural" || m === "informal")) {
      return "expression";
    }
    return kind === "linker" ? "linker" : "word";
  }
  switch (kind) {
    case "preposition_pattern":
      return "preposition";
    case "collocation":
      return "collocation";
    case "linker":
      return "linker";
    case "phrase":
    case "sentence_pattern":
    case "functional_expression":
      return "phrase";
    case "word":
      return "word";
    default:
      return null;
  }
}
