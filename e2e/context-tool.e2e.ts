import { describe, expect, it } from "vitest";

/**
 * The context tool as the learner sees it (Phase 4 Step 4.6), over HTTP against a production
 * build: the markup the server renders, without the data scripts that carry the raw response. It
 * renders the engine's context-gap answer as it is — groups in order, a verdict and reason on every
 * answer, pairs first, mistakes, honest empty and fallback states. Layout at each width and focus
 * visibility are checked in the browser (docs/DESIGN.md §12).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const explore = (query: string) => `/explore?q=${encodeURIComponent(query)}`;

/** The rendered page without its scripts, with the HTML entities React escapes decoded. */
async function rendered(path: string) {
  const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
  expect(response.status, path).toBe(200);
  return (await response.text())
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replaceAll("<!-- -->", "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

/** The answers' part of the page: everything before the labels' explanation. */
const answerArea = (page: string) => {
  const legend = page.indexOf("What the fit labels mean");
  return legend < 0 ? page : page.slice(0, legend);
};

/** The answers' verdicts, in order. */
const verdicts = (page: string) =>
  [...answerArea(page).matchAll(/data-verdict="(\w+)"/g)].map(([, verdict]) => verdict);

/** The answer buttons' accessible names, in order. */
const answers = (page: string) =>
  [...page.matchAll(/aria-label="Try “([^”]+)” in the sentence"/g)].map(([, fill]) => fill);

/** The answer groups' headings, in order. */
const headings = (page: string) =>
  [...page.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)]
    .map(([, text]) => text!)
    .filter((text) => text !== "Mistakes to avoid");

describe("one gap", () => {
  it("shows the sentence, each answer with its verdict and reason, and a way to the language", async () => {
    const page = await rendered(explore("responsible ___ the project"));
    expect(page).toContain("What fits this gap?");
    expect(page).toContain("Choose an answer to see it in your sentence.");
    expect(answers(page)).toEqual(["for", "to"]);
    expect(verdicts(page)).toEqual(["fits", "depends"]);
    expect(page).toMatch(/data-verdict="fits"[^>]*>.*?Fits<\/span>/);
    expect(page).toContain(
      "Matches the pattern “be responsible for + noun / -ing”, with a noun phrase after it.",
    );
    expect(page).toContain("How to use “responsible for”");
    expect(page).toMatch(/<button type="button" aria-pressed="false" aria-label="Try “for”/);
  });

  it("shows an unlikely answer with the mistake it would make, as a correction", async () => {
    const page = await rendered(explore("My family is very important ___ me"));
    expect(verdicts(page)).toEqual(["fits", "unlikely"]);
    expect(page).toContain("Mistakes to avoid");
    expect(page).toContain("My family is very important for me.");
    expect(page).toContain("My family is very important to me.");
    expect(page).toContain("Instead of ");
  });

  it("keeps the Phase 3 verb answer and its wording, with the new verdicts", async () => {
    const page = await rendered(
      explore("Governments should ____ more money into public transportation"),
    );
    expect(page).toContain("Which verb fits this sentence?");
    expect(page).toContain("Verbs for the gap, checked against “money” and “into”");
    expect(answers(page)).toEqual(["invest … into", "allocate … to", "devote … to"]);
    expect(verdicts(page)).toEqual(["fits", "unlikely", "not_supported"]);
  });

  it('answers "It is ___ that" only as likely fits, saying why', async () => {
    const page = await rendered(explore("It is ___ that governments should act"));
    expect(answers(page)).toEqual(["crucial", "essential"]);
    expect(verdicts(page)).toEqual(["likely_fits", "likely_fits"]);
    expect(page).toContain("only small function words around the gap match it");
  });

  it("explains the five labels in a disclosure, never as a score", async () => {
    const page = await rendered(explore("responsible ___ the project"));
    expect(page).toMatch(/<details[^>]*><summary[^>]*>What the fit labels mean<\/summary>/);
    for (const label of ["Fits", "Likely fits", "Depends", "Unlikely", "Not supported"]) {
      expect(page).toContain(`${label}</span>`);
    }
    expect(page).not.toMatch(/\d+ ?%|score/i);
  });
});

describe("two gaps", () => {
  it("shows the pairs first, as one answer for both gaps, then each gap's own answers", async () => {
    const page = await rendered(explore("Governments should ___ more money ___ public transport"));
    expect(page).toContain("What fits these gaps?");
    expect(headings(page)).toEqual([
      "Both gaps",
      "Gap 1 · Fits this sentence",
      "Gap 1 · Doesn't fit this sentence",
    ]);
    expect(page).toContain("Each answer fills both gaps together, as one pattern.");
    expect(page).toContain("The answers below are for one gap each. Lexora doesn’t combine them.");
    expect(answers(page).slice(0, 4)).toEqual([
      "invest … in",
      "invest … into",
      "allocate … to",
      "allocate … for",
    ]);
    // The blanks are numbered, for sight and for screen readers.
    expect(page).toContain('<span class="sr-only">gap 1</span>');
    expect(page).toContain('<span class="sr-only">gap 2</span>');
  });

  it("keeps a gap's independent answers in their own group after the pair", async () => {
    const page = await rendered(explore("The policy ___ rise ___ protests"));
    expect(headings(page)).toEqual([
      "Both gaps · give … to",
      "Gap 2 · Collocations with these words",
    ]);
  });

  it("never suggests a combination when no one pattern covers both gaps", async () => {
    const page = await rendered(explore("Cars are responsible ___ pollution and depend ___ oil"));
    expect(headings(page)).toEqual([
      "Gap 1 · Prepositions after “responsible”",
      "Gap 2 · Prepositions after “depend”",
    ]);
    expect(page).not.toContain("Both gaps");
    expect(page).not.toContain("fills both gaps");
  });

  it("shows what the engine answers for a known limitation, as it is (F4)", async () => {
    const page = await rendered(explore("___ a result ___ the new policy"));
    expect(headings(page)).toEqual(["Both gaps · as … of", "Gap 2 · Prepositions after “result”"]);
  });
});

describe("when there's no context answer", () => {
  it("says honestly that Lexora has no pattern for the gap yet", async () => {
    const page = await rendered(explore("I like ___ music"));
    expect(page).toContain("Lexora couldn’t find a pattern it knows for this gap yet");
    expect(page).toContain("Try adding a few words before or after the blank");
    expect(page).not.toContain("Find by context");
    expect(page).not.toMatch(/no correct answer/i);
  });

  it("shows ordinary results with a note for more than two gaps", async () => {
    const page = await rendered(explore("a significant ___ in ___ of ___ people"));
    expect(page).toContain("Lexora reads up to two gaps at a time");
    expect(page).not.toContain("Find by context");
    expect(page).toContain("“significant” and related language");
  });

  it("filters a gap answer after reading it, with the way back", async () => {
    const page = await rendered(
      `${explore("Governments should ___ more money ___ public transport")}&kind=linker`,
    );
    expect(page).toContain("but none match these filters");
    expect(page).not.toContain("Find by context");
  });
});

describe("ordinary search", () => {
  it.each(["important", "preposition after responsible", "however..."])(
    "is unchanged for %j: no context tool, no verdicts",
    async (query) => {
      const page = await rendered(explore(query));
      expect(page).not.toContain("Find by context");
      expect(verdicts(page)).toEqual([]);
      expect(page).not.toContain("Lexora reads up to two gaps");
    },
  );
});
