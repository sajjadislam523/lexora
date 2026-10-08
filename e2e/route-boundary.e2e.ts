import { describe, expect, inject, it } from "vitest";

/**
 * The route boundary, checked over HTTP against a real server: public discovery pages work for
 * anyone, personal learning pages redirect visitors to sign in, and saving needs an account.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;

const PUBLIC_PAGES = [
  "/",
  "/explore",
  "/explore?q=better%20word%20for%20important",
  "/language/important",
  "/language/significant",
  "/language/depend-on",
  "/language/however",
  "/language/furthermore",
  "/sign-in",
  "/sign-up",
  "/design-system",
];

const PROTECTED_PAGES = [
  "/home",
  "/finder",
  "/bank",
  "/practice",
  "/writing",
  "/speaking",
  "/progress",
  "/settings",
];

function get(path: string, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

const [{ email, cookie }] = inject("learners");

describe("public discovery layer", () => {
  it.each(PUBLIC_PAGES)("GET %s works without an account", async (path) => {
    const response = await get(path);
    expect(response.status).toBe(200);
  });

  it("leads with search on the landing page", async () => {
    const html = await (await get("/")).text();
    expect(html).toContain("Find the English you mean.");
    expect(html).toContain('placeholder="What are you trying to say?"');
  });

  it("answers searches on Explore, rendered on the server", async () => {
    const html = await (await get("/explore?q=preposition%20after%20responsible")).text();
    expect(html).toContain("responsible for");
    expect(html).toMatch(/<meta name="robots" content="noindex, follow"/);
  });

  it("serves language pages with SEO metadata and semantic headings", async () => {
    const html = await (await get("/language/significant")).text();
    expect(html).toMatch(
      /<title>significant — meaning, examples and how to use it · Lexora<\/title>/,
    );
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/language/significant"/>`);
    expect(html).toMatch(
      /<meta name="description" content="significant: Large or important enough/,
    );
    expect(html).toMatch(/<h1[^>]*>significant<\/h1>/);
    expect(html).toContain('"@type":"DefinedTerm"');
  });

  it("returns a real 404 for unknown language", async () => {
    expect((await get("/language/not-a-real-item")).status).toBe(404);
  });

  it("renders public pages the same for a signed-in learner — no user data", async () => {
    const html = await (await get("/language/significant", cookie)).text();
    expect(html).not.toContain(email);
  });

  it("publishes robots.txt and a sitemap of the public pages only", async () => {
    const robots = await (await get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /home");
    expect(robots).toContain("Disallow: /api/");
    const sitemap = await (await get("/sitemap.xml")).text();
    expect(sitemap).toContain(`${ORIGIN}/language/significant`);
    expect(sitemap).not.toContain("/home");
  });
});

describe("personal learning areas", () => {
  it.each(PROTECTED_PAGES)("GET %s redirects a visitor to sign in", async (path) => {
    const response = await get(path);
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!, BASE_URL);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it.each(PROTECTED_PAGES)("GET %s works for a signed-in learner", async (path) => {
    const response = await get(path, cookie);
    expect(response.status).toBe(200);
  });

  it("returns a visitor to the language page they came from after signing in", async () => {
    // Already signed in: the sign-in page forwards straight to the return path.
    const response = await get("/sign-in?next=%2Flanguage%2Fsignificant", cookie);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/language/significant");
  });
});

describe("saving language", () => {
  const save = (headers: Record<string, string>) =>
    fetch(`${BASE_URL}/api/bank/saved/significant.statistical`, { method: "PUT", headers });

  it("rejects a visitor", async () => {
    expect((await save({ origin: ORIGIN })).status).toBe(401);
  });

  it("rejects a cross-site request even with a session", async () => {
    expect((await save({ origin: "https://evil.example", cookie })).status).toBe(403);
  });

  it("accepts the signed-in learner", async () => {
    const response = await save({ origin: ORIGIN, cookie });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ senseId: "significant.statistical", saved: true });
    await fetch(`${BASE_URL}/api/bank/saved/significant.statistical`, {
      method: "DELETE",
      headers: { origin: ORIGIN, cookie },
    });
  });
});
