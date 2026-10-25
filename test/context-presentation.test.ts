import { beforeAll, describe, expect, it } from "vitest";

import {
  groupHeadings,
  groupScope,
  isPair,
  isVerbFrameAnswer,
  sentenceFills,
  sentenceLayout,
  toolHeading,
} from "@/features/finder/context-presentation";
import { LanguageSearchService } from "@/language/search/service";
import type { SearchResponse } from "@/language/search/types";
import { buildRows } from "@/server/content/build";

import { MemoryLanguageRepository } from "./memory-language-repository";
import { loadPublishedContent } from "./published-content";

/**
 * How the context tool presents the engine's real context-gap answers (Phase 4 Step 4.6): the
 * sentence's slots, what a chosen answer fills, and each group's scope and heading. Presentation
 * only — the candidates, verdicts, pairs and order are the engine's.
 */
let service: LanguageSearchService;

beforeAll(async () => {
  service = new LanguageSearchService(
    new MemoryLanguageRepository(buildRows(await loadPublishedContent())),
  );
});

const search = async (query: string) => (await service.search(query)) as SearchResponse;
const results = (response: SearchResponse) => response.groups.flatMap((group) => group.results);

describe("the sentence", () => {
  it("keeps the learner's words and marks each blank the engine read", async () => {
    const query = "Governments should ___ more money ___ public transport";
    const layout = sentenceLayout(query, await search(query));
    expect(layout).toEqual({
      parts: ["Governments should ", { gap: 0 }, " more money ", { gap: 1 }, " public transport"],
      blanks: 2,
      frame: false,
    });
  });

  it("splits the Phase 3 verb-frame answer around the preposition it read", async () => {
    const query = "Governments should ____ more money into public transportation";
    const layout = sentenceLayout(query, await search(query));
    expect(layout).toEqual({
      parts: [
        "Governments should ",
        { gap: 0 },
        " more money ",
        { gap: 1 },
        " public transportation",
      ],
      blanks: 1,
      frame: true,
    });
  });

  it("never treats a preposition after other candidates as a slot", async () => {
    const query = "responsible ___ the project";
    expect(sentenceLayout(query, await search(query))).toEqual({
      parts: ["responsible ", { gap: 0 }, " the project"],
      blanks: 1,
      frame: false,
    });
  });
});

describe("what a chosen answer fills", () => {
  it("puts a pair in both gaps", async () => {
    const query = "Governments should ___ more money ___ public transport";
    const response = await search(query);
    const pair = results(response).find(isPair)!;
    expect(sentenceFills(pair, sentenceLayout(query, response))).toEqual(["invest", "in"]);
  });

  it("puts a single-gap answer only in its own gap", async () => {
    const query = "The policy ___ rise ___ protests";
    const response = await search(query);
    const layout = sentenceLayout(query, response);
    const sharply = results(response).find((r) => r.fill?.word === "sharply")!;
    expect(sentenceFills(sharply, layout)).toEqual([undefined, "sharply"]);
    // A verb on the first gap of a two-gap sentence never fills the second.
    const money = "Governments should ___ more money ___ public transport";
    const moneyResponse = await search(money);
    const allocate = results(moneyResponse).find((r) => !isPair(r) && r.fill?.word === "allocate")!;
    expect(sentenceFills(allocate, sentenceLayout(money, moneyResponse))).toEqual(["allocate"]);
  });

  it("puts a Phase 3 verb and the preposition it brings in the sentence", async () => {
    const query = "Governments should ____ more money into public transportation";
    const response = await search(query);
    const invest = results(response).find((r) => r.fill?.word === "invest")!;
    expect(sentenceFills(invest, sentenceLayout(query, response))).toEqual(["invest", "into"]);
  });

  it("fills nothing before a choice", async () => {
    const query = "responsible ___ the project";
    expect(sentenceFills(undefined, sentenceLayout(query, await search(query)))).toEqual([]);
  });
});

describe("groups", () => {
  it("name their scope in a two-gap sentence, pairs first, as the engine ordered them", async () => {
    const response = await search("Governments should ___ more money ___ public transport");
    expect(groupHeadings(response.groups, 2)).toEqual([
      "Both gaps",
      "Gap 1 · Verbs for this gap",
      "Gap 1 · Other verbs Lexora checked",
    ]);
  });

  it("keep the engine's label when it already names the gap", async () => {
    const response = await search("The policy ___ rise ___ protests");
    // Content expansion: "policy on" and "rise in / by / to" now answer each gap on its own, after
    // the pair (only as likely fits).
    expect(groupHeadings(response.groups, 2)).toEqual([
      "Both gaps · give … to",
      "Gap 1 · Prepositions after “policy”",
      "Gap 2 · Prepositions after “rise”",
      "Gap 2 · Collocations with these words",
    ]);
  });

  it("have no scope in a one-gap sentence", async () => {
    const response = await search("responsible ___ the project");
    expect(groupScope(response.groups[0]!, 1)).toBeUndefined();
    expect(groupHeadings(response.groups, 1)).toEqual(["Prepositions after “responsible”"]);
  });
});

describe("verb-frame group headings (Phase 4 closure, UI-1)", () => {
  const verdicts = (response: SearchResponse, index: number) =>
    response.groups[index]!.results.map((result) => result.gapMatch?.verdict);

  it("keep the engine's positive label over a group where every verb fits", async () => {
    const response = await search("Companies ___ billions into research");
    expect(verdicts(response, 0)).toEqual(["fits"]);
    expect(groupHeadings(response.groups, 1)).toEqual([
      "Fits this sentence",
      "Other verbs Lexora checked",
    ]);
  });

  it("never say “Fits this sentence” over an unlikely verb", async () => {
    const response = await search("Governments should ____ more money into public transportation");
    expect(verdicts(response, 0)).toEqual(["fits", "unlikely"]);
    expect(groupHeadings(response.groups, 1)).toEqual([
      "Verbs for this gap",
      "Other verbs Lexora checked",
    ]);
  });

  it("give a neutral heading to mixed or uncertain verdicts", async () => {
    const response = await search("Governments should ___ more money ___ public transport");
    expect(verdicts(response, 1)).toEqual(["likely_fits", "likely_fits"]);
    expect(groupHeadings(response.groups, 2)[1]).toBe("Gap 1 · Verbs for this gap");
  });

  it("leave the engine's own labels as they were", async () => {
    const response = await search("Governments should ____ more money into public transportation");
    expect(response.groups.map((group) => group.label)).toEqual([
      "Fits this sentence",
      "Doesn't fit this sentence",
    ]);
  });
});

describe("the tool's heading", () => {
  it.each([
    [
      "Governments should ____ more money into public transportation",
      "Which verb fits this sentence?",
    ],
    ["responsible ___ the project", "What fits this gap?"],
    ["It is ___ that governments should act", "What fits this gap?"],
    ["Governments should ___ more money ___ public transport", "What fits these gaps?"],
  ])("%j → %j", async (query, title) => {
    const response = await search(query);
    expect(toolHeading(response, sentenceLayout(query, response)).title).toBe(title);
  });

  it("calls only an all-verb-frame answer to one gap a verb answer", async () => {
    expect(
      isVerbFrameAnswer(
        await search("Governments should ____ more money into public transportation"),
      ),
    ).toBe(true);
    expect(
      isVerbFrameAnswer(await search("Governments should ___ more money ___ public transport")),
    ).toBe(false);
  });
});
