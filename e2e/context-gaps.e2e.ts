import { describe, expect, it } from "vitest";

/**
 * Context gaps on the real pages, over HTTP against a production build. Step 4.1: an ellipsis used
 * as punctuation is an ordinary search, blanks are read as before, more than two are not
 * interpreted, URLs are unchanged. Step 4.2: prepositions, collocations and linkers are offered
 * from authored structures, and nothing is made up. Step 4.3: each candidate carries a verdict
 * with its evidence, in the response the page receives (the verdict UI is Step 4.6). Step 4.4:
 * no false fits from the learner's own word, and more of the authored evidence is read.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const explore = (query: string) => `/explore?q=${encodeURIComponent(query)}`;

async function html(path: string) {
  const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
  expect(response.status, path).toBe(200);
  return (await response.text()).replaceAll("<!-- -->", "");
}

describe("the gap reader on Explore", () => {
  it.each([
    ["however...", "“however” and related language"],
    ["There is growing concern about ...", "“There is growing concern about …”"],
    ["It is worth noting that...", "“It is worth noting that …”"],
  ])("searches %j as an ordinary query", async (query, heading) => {
    const page = await html(explore(query));
    expect(page).toContain(heading);
    expect(page).not.toContain("Find a word for the gap");
    expect(page).not.toContain("Which verb fits this sentence?");
  });

  it("reads underscore and between-word ellipsis blanks with the same verbs", async () => {
    for (const query of [
      "Governments should ____ more money into public transportation",
      "Governments should … more money into public transportation",
    ]) {
      const page = await html(explore(query));
      expect(page).toContain("Verbs for the gap, checked against “money” and “into”");
      expect(page).toContain("Which verb fits this sentence?");
    }
  });

  it("doesn't interpret more than two blanks", async () => {
    const page = await html(explore("a ___ b ___ c ___ d"));
    expect(page).not.toContain("Verbs for the gap");
    expect(page).not.toContain("Find a word for the gap");
  });

  it("keeps an unanswered blank a gap query, with the existing prompt", async () => {
    const page = await html(explore("Governments should ___ to public transport"));
    expect(page).toContain("Find a word for the gap — add the words that come after it");
  });

  it("adds no URL parameters: gap queries are canonical as typed", async () => {
    for (const query of ["however...", "Governments should ___ more money ___ public transport"]) {
      const response = await fetch(`${BASE_URL}${explore(query)}`, { redirect: "manual" });
      expect(response.status, query).toBe(200);
    }
  });

  it.each([
    [
      "responsible ___ the project",
      "Prepositions after “responsible”",
      ["responsible for", "responsible to"],
    ],
    ["depend ___ others", "Prepositions after “depend”", ["depend on"]],
    [
      "There was a ___ increase in cycling",
      "Collocations with these words",
      ["significant", "substantial"],
    ],
    [
      "Governments should take ___ to reduce crime",
      "Collocations with these words",
      ["measures", "steps"],
    ],
    [
      "___, it is often slow and crowded",
      "Linkers that start a sentence",
      ["however", "furthermore"],
    ],
    [
      "My brother loves the city, ___ I prefer the country",
      "Linkers that join two clauses",
      ["whereas"],
    ],
  ])("offers authored candidates for %j", async (query, reading, words) => {
    const page = await html(explore(query));
    expect(page).toContain(reading);
    for (const word of words) expect(page).toContain(word);
  });

  it("answers two blanks one at a time", async () => {
    const page = await html(explore("Cars are responsible ___ pollution and depend ___ oil"));
    expect(page).toContain("Language Lexora knows for these gaps");
    expect(page).toContain("responsible for");
    expect(page).toContain("depend on");
  });

  it.each(["a ___ the", "The ___ is high"])("makes nothing up for %j", async (query) => {
    const page = await html(explore(query));
    expect(page).not.toContain("Collocations with these words");
    expect(page).not.toContain("Prepositions after");
  });

  /** The verdicts and evidence codes in the response serialised into the page, in order. */
  const verdictsIn = (page: string) =>
    [...page.matchAll(/verdict\\":\\"(\w+)\\"/g)].map(([, verdict]) => verdict);

  it("sends a verdict with its evidence for each candidate", async () => {
    const page = await html(explore("My family is very important ___ me"));
    expect(page).toContain("Prepositions after “important”");
    expect(verdictsIn(page)).toEqual(["fits", "unlikely"]);
    expect(page).toContain("authored_mistake");
    expect(page).toContain("person_follows");
  });

  it("says when the fit depends on what follows", async () => {
    expect(verdictsIn(await html(explore("responsible ___ the project")))).toEqual([
      "fits",
      "depends",
    ]);
    const linkers = await html(explore("___, it is often slow and crowded"));
    expect(new Set(verdictsIn(linkers))).toEqual(new Set(["depends"]));
    expect(linkers).toContain("position:start");
  });

  it("keeps the verb-frame answer and adds its verdicts", async () => {
    const page = await html(
      explore("Governments should ____ more money into public transportation"),
    );
    expect(page).toContain("Verbs for the gap, checked against “money” and “into”");
    expect(verdictsIn(page)).toEqual(["fits", "unlikely", "not_supported"]);
  });

  it("judges two blanks one at a time", async () => {
    const page = await html(explore("Cars are responsible ___ pollution and depend ___ oil"));
    expect(page).toContain("Gap 1 · Prepositions after “responsible”");
    expect(page).toContain("Gap 2 · Prepositions after “depend”");
    expect(verdictsIn(page)).toEqual(["likely_fits", "depends", "likely_fits", "depends"]);
  });

  it("filters after judging, and says what the filters hid", async () => {
    const page = await html(`${explore("responsible ___ the project")}&kind=word`);
    expect(page).toContain("Your search found 2 results, but none match these filters");
  });

  it.each(["important", "however..."])(
    "gives the ordinary search %j no verdicts",
    async (query) => {
      expect(verdictsIn(await html(explore(query)))).toEqual([]);
    },
  );
});

describe("context coverage on Explore (Step 4.4)", () => {
  const verdictsIn = (page: string) =>
    [...page.matchAll(/verdict\\":\\"(\w+)\\"/g)].map(([, verdict]) => verdict);
  const fillsIn = (page: string) =>
    [...page.matchAll(/fill\\":\{\\"word\\":\\"([\w ]+)\\"/g)].map(([, word]) => word);

  it("doesn't offer the learner's own word, and hedges what it can't check", async () => {
    const page = await html(explore("Governments must take ___ measures"));
    expect(fillsIn(page)).toEqual(["urgent", "steps"]);
    expect(verdictsIn(page)).toEqual(["fits", "likely_fits"]);
    expect(page).toContain("other_side_unchecked");
  });

  it("reads a preposition after an inflected phrase", async () => {
    const page = await html(explore("Plastic waste poses a threat ___ marine life"));
    expect(page).toContain("Prepositions after “pose a threat”");
    expect(verdictsIn(page)).toEqual(["likely_fits"]);
  });

  it("reads the preposition after a verb frame's object", async () => {
    const page = await html(explore("The council allocated money ___ education"));
    expect(page).toContain("Prepositions after “allocated money”");
    expect(fillsIn(page)).toEqual(["to", "for"]);
    expect(page).toContain("frame_object");
    const unauthored = await html(explore("The council allocated land ___ housing"));
    expect(verdictsIn(unauthored)).toEqual(["not_supported", "not_supported"]);
  });

  it("reads a verb collocation before an article, and authored inflections", async () => {
    expect(fillsIn(await html(explore("Plastic waste ___ a threat to marine life")))).toEqual([
      "pose",
    ]);
    const page = await html(explore("The government took ___ to reduce crime"));
    expect(fillsIn(page)).toEqual(["measures", "steps"]);
    expect(page).toContain("authored_form");
  });

  it("never fits a collocation after a function word it can't check", async () => {
    const page = await html(explore("There is ___ a threat"));
    expect(fillsIn(page)).toEqual(["pose"]);
    expect(verdictsIn(page)).toEqual(["likely_fits"]);
    expect(verdictsIn(await html(explore("Plastic waste ___ a threat to marine life")))).toEqual([
      "fits",
    ]);
  });

  it('still makes nothing up for "It is ___ that"', async () => {
    expect(verdictsIn(await html(explore("It is ___ that governments act")))).toEqual([]);
  });
});
