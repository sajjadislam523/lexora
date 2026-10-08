import { describe, expect, inject, it } from "vitest";

/**
 * Explore and the Finder over HTTP against a real server and the imported content: both are
 * answered by the Phase 3 language engine, give visitors and learners the same language, link to
 * real language records, and never show the Phase 1 sample data.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** The six acceptance scenarios for Phase 3 step 9, with text each response must contain. */
const SCENARIOS: [query: string, expected: string[]][] = [
  ["important", ["“important” and related language", "Stronger than important", "fundamental"]],
  [
    "preposition after responsible",
    ["Prepositions after “responsible”", "responsible to", "responsible of"],
  ],
  [
    "Governments should ____ more money into public transportation",
    ["Verbs for the gap, checked against “money” and “into”", "invest", "allocate", "devote"],
  ],
  ["I want to express contrast", ["Language to express contrast", "Between sentences", "whereas"]],
  [
    "natural speaking alternative to furthermore",
    ["Natural spoken alternatives to “furthermore”", "on top of that", "what&#x27;s more"],
  ],
  [
    "responsable for",
    ["Showing results for “responsible for”", "Closest spelling to “responsable for”"],
  ],
  ["analyze", ["Spelling variant", "Matches “analyze”, the US spelling"]],
];

/** Phrases that only exist in the Phase 1 sample data (src/demo). */
const SAMPLE_DATA = [
  "Important enough to have a noticeable effect or influence.",
  "Matched on “",
  "matched by keyword",
];

function get(path: string, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, { headers: cookie ? { cookie } : {} });
}

/** Page HTML without React's text separators (`<!-- -->`), so sentences match as written. */
async function html(path: string, cookie?: string) {
  const response = await get(path, cookie);
  expect(response.status).toBe(200);
  return (await response.text()).replaceAll("<!-- -->", "");
}

const search = (base: "/explore" | "/finder", query: string) =>
  `${base}?q=${encodeURIComponent(query)}`;

/** The results region as text: from "Understood as" to the "More searches" footer. */
function resultsText(html: string) {
  const start = html.indexOf("Understood as");
  const end = html.indexOf("More searches", start);
  expect(start).toBeGreaterThan(-1);
  return html
    .slice(start, end > start ? end : undefined)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const [{ cookie }] = inject("learners");

describe("Explore and the Finder use the language engine", () => {
  it.each(SCENARIOS)(
    "a visitor searching %j on Explore gets real results",
    async (query, expected) => {
      const response = await get(search("/explore", query));
      expect(response.status).toBe(200);
      const html = await response.text();
      for (const text of expected) expect(html).toContain(text);
    },
  );

  it.each(SCENARIOS)(
    "a signed-in learner gets the same language for %j on the Finder",
    async (query) => {
      const [explore, finder] = await Promise.all([
        html(search("/explore", query)),
        html(search("/finder", query), cookie),
      ]);
      expect(resultsText(finder)).toBe(resultsText(explore));
    },
  );

  it("links results to published language records", async () => {
    const page = await html(search("/explore", "better word for important"));
    const slugs = [...page.matchAll(/href="\/language\/([a-z0-9-]+)(?:#[a-z0-9-]+)?"/g)].map(
      (m) => m[1],
    );
    // A result about one meaning opens the page at that meaning.
    expect(page).toContain('href="/language/significant#sense-notable"');
    expect(slugs).toEqual(
      expect.arrayContaining(["significant", "crucial", "essential", "fundamental"]),
    );
  });

  it.each(["/", "/explore", search("/explore", "important"), search("/explore", "furthermore")])(
    "%s shows no Phase 1 sample language",
    async (path) => {
      const page = await html(path);
      for (const text of SAMPLE_DATA) expect(page).not.toContain(text);
    },
  );

  it("says honestly when nothing matches", async () => {
    const page = await html(search("/explore", "xyzzy"));
    expect(page).toContain("Nothing in Lexora matches “xyzzy” yet");
  });
});
