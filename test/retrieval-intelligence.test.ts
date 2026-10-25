import { beforeAll, describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS, FILTER_VALUES, type SearchFilters } from "@/language/filters";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse, SearchResult } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * Phase 6B retrieval intelligence on the published content, in memory: request normalisation,
 * descriptors, word classes in gaps, relation ranking, longer queries and tasks. Ranking quality
 * across many queries is measured by the benchmark (test/retrieval-benchmark.yaml); these pin
 * the mechanisms.
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

const results = (response: SearchResponse | null) =>
  response?.groups.flatMap((group) => group.results) ?? [];
const terms = (response: SearchResponse | null) => results(response).map((r) => r.term);
const slugs = (response: SearchResponse | null) => results(response).map((r) => r.slug);
const verdicts = (response: SearchResponse | null) =>
  results(response).map((r) => `${r.term}=${r.gapMatch?.verdict}`);
/** The answer without the fields that echo the query. */
const answer = (response: SearchResponse | null) => ({
  intent: response?.interpretation.intent,
  term: response?.interpretation.term?.resolved,
  groups: response?.groups,
});

describe("request normalisation", () => {
  it("answers variants of one request exactly alike", async () => {
    const plain = answer(await service.search("better word for important"));
    for (const variant of [
      "Better word for IMPORTANT?!",
      "a better word for important",
      "what is a better word for important",
      "what's a better word for important",
      "can you give me a better word for important please",
    ]) {
      expect(answer(await service.search(variant)), variant).toEqual(plain);
    }
  });

  it("reads synonyms through other phrasings", async () => {
    expect(slugs(await service.search("alternative word for important")).slice(0, 3)).toEqual(
      slugs(await service.search("another word for important")).slice(0, 3),
    );
    expect(slugs(await service.search("formal way to say think")).slice(0, 2)).toEqual([
      "argue",
      "believe",
    ]);
  });

  it("reads a request for words for an idea as that intent", async () => {
    const response = await service.search("words to express contrast");
    expect(response?.interpretation.intent).toBe("PHRASE");
    expect(response?.interpretation.summary).toBe("Language to express contrast");
  });

  it("reads loosely phrased ideas", async () => {
    expect((await service.search("phrase for concluding"))?.interpretation.summary).toBe(
      "Language to conclude or summarise",
    );
    expect(
      (await service.search("phrase for introducing a solution"))?.interpretation.summary,
    ).toBe("Language to propose a solution");
  });

  it("reads an article in a preposition question as asking about the noun", async () => {
    expect(terms(await service.search("preposition after an increase"))[0]).toBe("increase in");
    expect(terms(await service.search("preposition after increase"))[0]).toBe("increase by");
  });
});

describe("tasks", () => {
  it("keeps every result and puts those used in the task first", async () => {
    const plain = await service.search("word for important");
    const tasked = await service.search("IELTS Task 2 word for important");
    expect(tasked?.interpretation.task).toBe("writing-2");
    expect(new Set(terms(tasked))).toEqual(new Set(terms(plain)));
  });

  it("names the task in the summary only when something is used in it", async () => {
    const response = await service.search("Task 1 phrase for describing an increase");
    expect(response?.interpretation.summary).toMatch(/· Writing Task 1 first$/);
  });

  it("doesn't read a task into a plain lookup", async () => {
    const response = await service.search("writing task 1 language");
    expect(response?.interpretation.intent).toBe("LOOKUP");
    expect(response?.interpretation.task).toBeUndefined();
  });
});

describe("descriptors", () => {
  it.each([
    [
      "word for a large increase",
      ["significant", "substantial"],
      ["slightly", "marginally", "dip"],
    ],
    ["word for a small increase", ["slightly"], ["surge", "jump", "significant", "dip"]],
    ["word for a rapid increase", ["increase", "rise-sharply"], ["gradually", "slightly", "climb"]],
    ["word for a gradual increase", ["steadily"], ["surge", "soar", "jump", "sharply"]],
    ["word for a large decrease", ["plunge"], ["increase", "dip", "slightly"]],
  ])("%j: first %j, never %j", async (query, first, never) => {
    const response = await service.search(query);
    expect(response?.interpretation.descriptor).toBeDefined();
    expect(slugs(response).slice(0, first.length)).toEqual(first);
    for (const slug of never) expect(slugs(response), slug).not.toContain(slug);
  });

  it("explains every result by its evidence", async () => {
    const response = await service.search("word for a large increase");
    const reasons = new Map(results(response).map((r) => [r.term, r.reason]));
    expect(reasons.get("a significant increase")).toMatch(/^A collocation for “a large increase”/);
    expect(reasons.get("jump")).toBe("Its definition describes “a large increase”");
    expect(reasons.get("considerable")).toBe("Means large, and Lexora uses it with “rose”");
    expect(reasons.get("surge")).toBe("Its definition describes “a large increase”");
  });

  it("puts the shape asked for first: a noun phrase for an adjective", async () => {
    const collocations = (await service.search("word for a large increase"))?.groups[0];
    expect(collocations?.label).toBe("Collocations");
    expect(collocations?.results.map((r) => r.term).slice(0, 4)).toEqual([
      "a significant increase",
      "a substantial increase",
      "a dramatic rise",
      "a marked increase",
    ]);
  });

  it("never offers the learner's own phrase", async () => {
    expect(terms(await service.search("word for a sharp increase"))).not.toContain(
      "a sharp increase",
    );
  });

  it("asks for a stronger word with an intensity word", async () => {
    const response = await service.search("word meaning very important");
    expect(response?.interpretation.intent).toBe("STRONGER_ALTERNATIVE");
    expect(terms(response)).toEqual(["crucial", "essential"]);
  });

  it("says so, and falls back to the head word, when no content says both", async () => {
    const response = await service.search("word for a gradual opinion");
    expect(response?.interpretation.summary).toMatch(
      /^Lexora has nothing that says “gradual” with “opinion” — /,
    );
  });

  it("keeps the reading and order under filters, with fewer results", async () => {
    const query = "word for a large increase";
    const plain = (await service.search(query))!;
    const keys = results(plain).map((r) => r.key);
    for (const dimension of FILTER_DIMENSIONS) {
      for (const value of FILTER_VALUES[dimension]) {
        const filters = { [dimension]: value } as SearchFilters;
        const filtered = (await service.search(query, filters))!;
        expect(filtered.interpretation, JSON.stringify(filters)).toEqual(plain.interpretation);
        const kept = results(filtered).map((r) => r.key);
        expect(keys.filter((key) => kept.includes(key))).toEqual(kept);
      }
    }
  });
});

describe("relation ranking", () => {
  it("puts words of the term's class first", async () => {
    expect(terms(await service.search("academic word for think"))).toEqual([
      "argue",
      "believe",
      "in my opinion",
    ]);
  });

  it("puts the authored more formal choices first for a formal request", async () => {
    expect(terms(await service.search("formal word for good")).slice(0, 2)).toEqual([
      "beneficial",
      "positive",
    ]);
  });

  it("leaves a request without modifiers in authored weight order", async () => {
    expect(terms(await service.search("better word for important"))).toEqual([
      "significant",
      "crucial",
      "essential",
      "fundamental",
      "key",
      "major",
    ]);
  });
});

describe("longer queries", () => {
  it.each([
    ["depend on public transport", "depend on", "public transport"],
    ["contribute to climate change", "contribute to", "climate change"],
    ["people depend on cars", "depend on", undefined],
    ["rely on social media", "rely on", "social media"],
  ])("%j is about %j", async (query, first, also) => {
    const response = await service.search(query);
    expect(response?.interpretation.term?.resolved).toBe(first);
    const extra = response?.groups.find((g) => g.label === "Also in your search");
    if (also) expect(extra?.results.map((r) => r.term)).toContain(also);
  });

  it("keeps the longest term when no pattern is in use", async () => {
    expect((await service.search("reduce greenhouse gases"))?.interpretation.term?.resolved).toBe(
      "greenhouse gases",
    );
  });
});

describe("context gaps: word classes", () => {
  it("drops collocations whose word can't follow the verb (suffer ___ poverty)", async () => {
    const response = await service.search("suffer ___ poverty");
    expect(terms(response)[0]).toBe("suffer from");
    expect(terms(response)).not.toContain("reduce poverty");
    expect(terms(response)).not.toContain("alleviate poverty");
    // "poverty" is an authored noun: the noun phrase after "from" is checked.
    expect(results(response)[0]?.gapMatch?.verdict).toBe("fits");
  });

  it("explains why a preposition can't go before another, and lists what fits first", async () => {
    const response = await service.search("Prices rose ___ in 2020.");
    expect(verdicts(response)).toEqual([
      "rose sharply=fits",
      "rise dramatically=fits",
      "rise gradually=fits",
      "rise steadily=fits",
      "rise in=unlikely",
      "rise by=unlikely",
      "rise to=unlikely",
    ]);
    const by = results(response).find((r) => r.term === "rise by") as SearchResult;
    expect(by.gapMatch?.signals).toEqual(["word_class", "before_preposition"]);
    expect(by.reason).toBe(
      "A preposition can't come straight before “in”: the gap needs another kind of word.",
    );
    expect(response?.gaps?.[0]?.type).toBe("collocation");
  });

  it("drops adverbs before a noun phrase, and a noun pattern on a verb (prices rose ___ 2020)", async () => {
    const response = await service.search("prices rose ___ 2020");
    expect(verdicts(response)).toEqual(["rise by=fits", "rise to=fits", "rise in=unlikely"]);
    expect(results(response).find((r) => r.term === "rise in")?.reason).toBe(
      "“a rise in + noun” uses its word as a noun, but “rose” here is a verb.",
    );
  });

  it("keeps an authored mistake as the evidence when it applies", async () => {
    const response = await service.search("responsible ___ the problem");
    expect(terms(response)[0]).toBe("responsible for");
  });

  it("lists contrast linkers first between authored opposites, still Depends", async () => {
    const response = await service.search("Prices rose, ___ demand fell");
    expect(terms(response).slice(0, 2)).toEqual(["whereas", "while"]);
    expect(new Set(results(response).map((r) => r.gapMatch?.verdict))).toEqual(
      new Set(["depends"]),
    );
    expect(results(response)[0]?.reason).toMatch(/“rose” and “fell” are opposites/);
    const other = await service.search("My brother loves the city, ___ I prefer the country");
    expect(terms(other)[0]).toBe("because");
  });
});

describe("determinism", () => {
  it("gives the same response every time", async () => {
    for (const query of [
      "word for a large increase",
      "suffer ___ poverty",
      "depend on public transport",
      "IELTS Task 1 word for increase",
      "Prices rose, ___ demand fell",
    ]) {
      expect(await service.search(query), query).toEqual(await service.search(query));
    }
  });
});
