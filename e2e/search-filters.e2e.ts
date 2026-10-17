import { describe, expect, inject, it } from "vitest";

/**
 * Search filters and browse (Phase 4 Step 3b) over HTTP against a real server and the imported
 * content: canonical URLs and 307 redirects, filtered search, browse with pages and counts, the
 * honest empty states, robots/canonical tags, and the same behaviour for visitors on /explore and
 * signed-in learners on /finder. Layout, focus and keyboard are checked in the browser (see the PR).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;
const [{ cookie }] = inject("learners");

function get(path: string, init: { cookie?: string; follow?: boolean } = {}) {
  return fetch(`${BASE_URL}${path}`, {
    headers: init.cookie ? { cookie: init.cookie } : {},
    redirect: init.follow === false ? "manual" : "follow",
  });
}

/** Page HTML without React's text separators, so sentences match as written. */
async function html(path: string, cookie?: string) {
  const response = await get(path, { cookie });
  expect(response.status, path).toBe(200);
  return (await response.text()).replaceAll("<!-- -->", "");
}

/** The browse rows' terms, in order. */
function rowTerms(page: string) {
  return [...page.matchAll(/data-slot="language-row"[\s\S]*?type-term-sm[^>]*>([^<]+)</g)].map(
    ([, term]) => term,
  );
}

/** The result cards' terms (search mode), in order: the card's term is its stretched link. */
function cardTerms(page: string) {
  return [...page.matchAll(/data-card-link="true"[^>]*>([^<]+)</g)].map(([, term]) => term);
}

describe("canonical Finder URLs", () => {
  it.each([
    // Order: q, kind, function, use, topic, page.
    [
      "/explore?topic=environment&kind=preposition-pattern&q=test",
      "/explore?q=test&kind=preposition-pattern&topic=environment",
    ],
    // The enum spelling of a kind is not a URL value.
    ["/explore?kind=preposition_pattern", "/explore"],
    ["/explore?kind=linker&page=1", "/explore?kind=linker"],
    ["/explore?kind=linker&kind=word", "/explore?kind=linker"],
    ["/explore?topic=sport&use=speaking", "/explore?use=speaking"],
    ["/explore?utm_source=mail&function=contrast", "/explore?function=contrast"],
    ["/explore?q=important&page=2", "/explore?q=important"],
    ["/explore?kind=linker&page=abc", "/explore?kind=linker"],
    ["/explore?kind=linker' OR 1=1 --", "/explore"],
    ["/explore?q=%20important%20", "/explore?q=important"],
    // Past the last page: the last page.
    ["/explore?use=writing&page=9", "/explore?use=writing&page=2"],
    ["/finder?use=speaking&kind=linker", "/finder?kind=linker&use=speaking"],
  ])("redirects %s with 307 to its canonical URL", async (from, to) => {
    const response = await get(from, { cookie, follow: false });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(to);
    // The destination is canonical: no further redirect.
    expect((await get(to, { cookie, follow: false })).status).toBe(200);
  });

  it.each([
    "/explore",
    "/explore?q=important",
    "/explore?kind=linker",
    "/explore?use=writing&page=2",
  ])("serves canonical %s directly", async (path) => {
    expect((await get(path, { follow: false })).status).toBe(200);
  });
});

describe("browsing by filters (no query)", () => {
  it("lists every linker, core first, as compact rows", async () => {
    const page = await html("/explore?kind=linker");
    expect(page).toContain("11 meanings");
    expect(page).toContain("Core IELTS language first, then A–Z");
    const terms = rowTerms(page);
    expect(terms).toHaveLength(11);
    expect(terms.slice(0, 3)).toEqual(["as a result", "for instance", "furthermore"]);
    expect(page).toMatch(/Showing only <span><a [^>]*>Linker<\/a><\/span> · 11 meanings ·/);
  });

  it("combines filters with AND", async () => {
    expect(await html("/explore?kind=linker&use=speaking")).toContain("7 meanings");
    expect(rowTerms(await html("/explore?kind=linker&function=contrast&use=writing-1"))).toEqual([
      "however",
      "in contrast",
      "whereas",
    ]);
  });

  it("pages 30 at a time, keeping the filters in the page links", async () => {
    const first = await html("/explore?use=writing");
    expect(first).toContain("41 meanings");
    expect(rowTerms(first)).toHaveLength(30);
    expect(first).toContain('href="/explore?use=writing&amp;page=2"');
    expect(first).toContain("Page 1 of 2");
    const second = await html("/explore?use=writing&page=2");
    expect(rowTerms(second)).toHaveLength(11);
    expect(second).toContain('href="/explore?use=writing"');
    expect(new Set([...rowTerms(first), ...rowTerms(second)]).size).toBeGreaterThan(30);
  });

  it("says honestly when no language matches", async () => {
    const page = await html("/explore?topic=environment");
    expect(page).toContain("No language matches these filters yet");
    expect(page).toContain("isn’t tagged with one");
    expect(rowTerms(page)).toEqual([]);
    expect(await html("/explore?function=hedging")).toContain(
      "No language matches these filters yet",
    );
  });

  it("shows how many each option would match and disables those that would match nothing", async () => {
    const page = await html("/explore?kind=linker");
    expect(page).toMatch(/<option value="contrast">Contrast \(5\)<\/option>/);
    expect(page).toMatch(/<option value="hedging" disabled="">Softening a claim \(0\)<\/option>/);
    expect(page).toMatch(/<option value="environment" disabled="">Environment \(0\)<\/option>/);
    // The selected option stays enabled.
    expect(page).toMatch(/<option value="linker" selected="">Linker \(11\)<\/option>/);
  });

  it("offers counts on the start page too, every value listed", async () => {
    const page = await html("/explore");
    expect(page).toMatch(/<option value="linker">Linker \(11\)<\/option>/);
    for (const topic of ["education", "environment", "health", "society"]) {
      expect(page).toMatch(new RegExp(`<option value="${topic}" disabled="">`));
    }
  });
});

describe("searching with filters", () => {
  it("keeps the engine's reading and only removes results that don't match", async () => {
    const plain = cardTerms(await html("/explore?q=important"));
    const page = await html("/explore?q=important&use=speaking");
    const filtered = cardTerms(page);
    expect(page).toContain("“important” and related language");
    expect(plain).toContain("fundamental");
    expect(filtered).not.toContain("fundamental");
    expect(plain.filter((term) => filtered.includes(term))).toEqual(filtered);
    expect(page).toContain(`${filtered.length} of ${plain.length} results`);
  });

  it("says when the filters hide every result, with the way back", async () => {
    const page = await html("/explore?q=important&topic=environment");
    expect(page).toContain("Your search found 5 results, but none match these filters");
    expect(page).toContain('href="/explore?q=important"');
    expect(page).toContain("Show all 5 results");
    expect(page).not.toContain("Nothing in Lexora matches");
  });

  it("filters prepositions, gaps and kinds without re-reading the query", async () => {
    const prepositions = await html("/explore?q=preposition+after+responsible&kind=linker");
    expect(prepositions).toContain("Your search found 2 results, but none match these filters");
    const gap = await html(
      `/explore?q=${encodeURIComponent("Governments should ____ more money into public transportation")}&use=speaking`,
    );
    expect(gap).toContain("Verbs for the gap, checked against “money” and “into”");
    expect(gap).toContain("invest");
    expect(gap).not.toMatch(/>allocate</);
  });
});

describe("indexing", () => {
  it("doesn't index filtered or paged views, and makes each canonical to itself", async () => {
    for (const path of [
      "/explore?kind=linker",
      "/explore?use=writing&page=2",
      "/explore?q=important&topic=health",
    ]) {
      const page = await html(path);
      expect(page).toMatch(/<meta name="robots" content="noindex, follow"/);
      expect(page).toContain(
        `<link rel="canonical" href="${ORIGIN}${path.replaceAll("&", "&amp;")}"/>`,
      );
    }
  });

  it("leaves plain searches as they were (D13 is not part of this step)", async () => {
    const page = await html("/explore?q=important");
    expect(page).toMatch(/<meta name="robots" content="noindex, follow"/);
    expect(page).toContain(`<link rel="canonical" href="${ORIGIN}/explore"/>`);
  });

  it("keeps the sitemap to public pages, without filtered views", async () => {
    const sitemap = await (await get("/sitemap.xml")).text();
    expect(sitemap).not.toMatch(/explore\?/);
  });
});

describe("visitors and learners get the same filters", () => {
  it("lets a visitor browse and filter on /explore without an account", async () => {
    const response = await get("/explore?kind=linker&use=speaking", { follow: false });
    expect(response.status).toBe(200);
  });

  it.each([
    "/explore?kind=linker&use=speaking",
    "/explore?q=important&use=speaking",
    "/explore?q=important&topic=environment",
  ])("gives a signed-in learner the same results on /finder for %s", async (path) => {
    const finderPath = path.replace("/explore", "/finder");
    const [explore, finder] = await Promise.all([html(path), html(finderPath, cookie)]);
    expect(rowTerms(finder)).toEqual(rowTerms(explore));
    expect(cardTerms(finder)).toEqual(cardTerms(explore));
  });

  it("still sends visitors to sign in for /finder", async () => {
    const response = await get("/finder?kind=linker", { follow: false });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});
