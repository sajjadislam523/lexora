import type { LanguageRepository } from "./repository";
import type { LanguageItem, SearchMode, SearchResult } from "./types";

/** Longest query the service will read; anything longer is cut, not rejected. */
export const MAX_QUERY_LENGTH = 200;

/** Lower-case, straighten quotes, drop punctuation (keeping the ___ gap marker), squash spaces. */
export function normaliseQuery(input: string) {
  return input
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z_'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "However," → "however" — terms are matched without their display punctuation. */
function termKey(item: LanguageItem) {
  return normaliseQuery(item.term);
}

const MODE_BY_CATEGORY: Record<LanguageItem["category"], SearchMode> = {
  vocabulary: "word",
  synonym: "word",
  preposition: "preposition",
  collocation: "collocation",
  linker: "linker",
  pattern: "phrase",
  expression: "expression",
};

/**
 * Deterministic search over the language repository. No AI, embeddings or ranking models:
 * every result can be traced to a rule below, and the result says which word matched.
 *
 * 1. The query is exactly a known term ("depend on") → that item and its related language.
 * 2. A keyword of a hand-written example search appears in the query → that search.
 * 3. A known term appears inside the query ("synonym for crucial") → that item.
 * Otherwise there is no match, and the UI says so.
 */
export class LanguageSearchService {
  constructor(private readonly repository: LanguageRepository) {}

  search(input: string): SearchResult | null {
    const query = input.trim().slice(0, MAX_QUERY_LENGTH);
    const normalised = normaliseQuery(query);
    if (!normalised) return null;

    const items = this.repository.listItems();
    const exact = items.find((item) => termKey(item) === normalised);
    if (exact) return this.termResult(query, exact);

    const example = this.matchExampleSearch(query, normalised);
    if (example) return example;

    const padded = ` ${normalised} `;
    const contained = [...items]
      .filter((item) => termKey(item).length >= 4)
      .sort((a, b) => termKey(b).length - termKey(a).length)
      .find((item) => padded.includes(` ${termKey(item)} `));
    if (contained) return this.termResult(query, contained);

    return { kind: "no-match", query };
  }

  private matchExampleSearch(query: string, normalised: string): SearchResult | undefined {
    const words = new Set(normalised.split(" "));
    for (const example of this.repository.listExampleSearches()) {
      const keyword = example.match.find((k) =>
        k === "___" ? query.includes("___") : words.has(k),
      );
      if (!keyword) continue;
      const skillItem = example.skillPairFrom
        ? this.repository.getItem(example.skillPairFrom)
        : undefined;
      return {
        kind: "match",
        query,
        mode: example.mode,
        understoodAs: example.understoodAs,
        matchedOn: keyword === "___" ? "the gap ___" : keyword,
        items: example.results.map((slug) => this.require(slug)),
        guide: example.guide,
        skillPair: skillItem?.usage,
        contextTool: example.mode === "context",
        related: example.related ?? [],
      };
    }
    return undefined;
  }

  private termResult(query: string, item: LanguageItem): SearchResult {
    const term = item.term.replace(/,$/, "");
    const related = (item.related ?? [])
      .map((relation) => (relation.slug ? this.repository.getItem(relation.slug) : undefined))
      .filter((related): related is LanguageItem => related !== undefined);
    return {
      kind: "match",
      query,
      mode: MODE_BY_CATEGORY[item.category],
      understoodAs: `“${term}” and related language`,
      matchedOn: term,
      items: [item, ...related],
      skillPair: item.usage,
      contextTool: false,
      related: this.repository
        .listExampleSearches()
        .filter((example) => example.results.includes(item.slug))
        .map((example) => example.text),
    };
  }

  private require(slug: string) {
    const item = this.repository.getItem(slug);
    if (!item) throw new Error(`Example search refers to an unknown language item: ${slug}`);
    return item;
  }
}
