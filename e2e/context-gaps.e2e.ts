import { describe, expect, it } from "vitest";

/**
 * The gap reader on the real pages (Phase 4 Step 4.1), over HTTP against a production build: an
 * ellipsis used as punctuation is an ordinary search, blanks are read as before, more than two are
 * not interpreted, and URLs are unchanged.
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
});
