import { describe, expect, it } from "vitest";

import { buildRows } from "@/server/content/build";
import { validateContent } from "@/server/content/validate";

import { LanguageSearchService } from "@/language/search/service";

import { fixtureContent, toFiles, type FixtureContent } from "./content-fixture";
import { MemoryLanguageRepository } from "./memory-language-repository";

function serviceFor(mutate?: (content: FixtureContent) => void) {
  const content = fixtureContent();
  mutate?.(content);
  const result = validateContent(toFiles(content));
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
  return new LanguageSearchService(new MemoryLanguageRepository(buildRows(result.content)));
}

const terms = (response: Awaited<ReturnType<LanguageSearchService["search"]>>) =>
  response?.groups.flatMap((group) => group.results.map((result) => result.term)) ?? [];

describe("LanguageSearchService", () => {
  it("ignores empty queries", async () => {
    expect(await serviceFor().search("   ")).toBeNull();
    expect(await serviceFor().search("?!")).toBeNull();
  });

  it("explains every result and returns content only", async () => {
    const response = await serviceFor().search("better word for important");
    expect(response).toMatchObject({
      interpretation: { intent: "SYNONYM", summary: "Alternatives to “important”" },
      outcome: "results",
    });
    const [result] = response!.groups[0]!.results;
    expect(result).toMatchObject({
      senseId: "crucial.essential",
      slug: "crucial",
      reason: "Stronger than important · Crucial means an outcome depends on it.",
    });
    expect(Object.keys(result!)).not.toContain("saved");
  });

  it("gives the same response every time", async () => {
    const service = serviceFor();
    expect(await service.search("important")).toEqual(await service.search("important"));
  });

  it("never shows drafts", async () => {
    const service = serviceFor((c) => {
      c.items.analyse!.status = "draft";
      c.items.analyse!.review = { author: "claude" };
    });
    const response = await service.search("analyse");
    expect(response?.outcome).toBe("none");
  });

  it("shows a tie as 'did you mean' instead of guessing", async () => {
    const service = serviceFor((c) => {
      c.items.crucial!.forms = [
        { form: "crucial", type: "lemma" },
        { form: "crucian", type: "inflection" },
      ];
    });
    const response = await service.search("crucia");
    expect(response?.didYouMean).toEqual(["crucial", "crucian"]);
    expect(response?.groups).toEqual([]);
  });

  it("falls back to a lookup when a question's term is unknown", async () => {
    const response = await serviceFor().search("better word for nonsense");
    expect(response?.interpretation.intent).toBe("LOOKUP");
    expect(response?.outcome).toBe("none");
  });

  it("finds a known term inside a longer query", async () => {
    const response = await serviceFor().search("is crucial too strong here");
    expect(terms(response)[0]).toBe("crucial");
    expect(response?.groups[0]!.results[0]!.reason).toBe("Contains “crucial”");
  });

  it("labels full-text matches as a fallback", async () => {
    const response = await serviceFor().search("outcome depends");
    expect(response?.outcome).toBe("fallback");
    expect(response?.interpretation.summary).toMatch(/showing language that mentions it/);
  });

  it("explains a stored mistake rather than silently correcting it", async () => {
    const response = await serviceFor().search("Family is very important for me");
    expect(response?.mistakes).toEqual([
      {
        wrong: "Family is very important for me.",
        right: "Family is very important to me.",
        explanation: 'Use "important to" for what matters to a person.',
      },
    ]);
    expect(terms(response)).toEqual(["important"]);
  });
});
