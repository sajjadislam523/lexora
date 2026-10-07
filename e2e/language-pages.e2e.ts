import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Language pages over HTTP against a real server and the imported content: every published item
 * has a page with its real content, search results never lead to a 404, each meaning keeps its
 * own relations, and nothing from the Phase 1 sample data appears.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;

/** Text only the Phase 1 sample items contained (IPA and sample meanings). */
const SAMPLE_DATA = [
  "/sɪɡˈnɪfɪkənt/",
  "/ˈkruːʃl/",
  "Important enough to have a noticeable effect or influence.",
  "Practise this",
];

/** Searches whose results the pages must answer: the acceptance scenarios and examples. */
const SEARCHES = [
  "important",
  "better word for important",
  "preposition after responsible",
  "Governments should ____ more money into public transportation",
  "Governments should ___ more money to public transport",
  "I want to express contrast",
  "natural speaking alternative to furthermore",
  "alternative to however",
  "collocations with significant",
  "phrase for giving an example",
  "phrase for causing a serious problem",
  "I want to say something increased significantly",
  "responsable for",
  "analyze",
];

type Published = { slug: string; headword: string; definition: string };
let published: Published[] = [];

async function page(path: string) {
  const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
  return { status: response.status, html: decode(await response.text()) };
}

/** HTML text as written: React's text separators removed, common entities decoded. */
function decode(html: string) {
  return html
    .replaceAll("<!-- -->", "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** The HTML of one meaning's section on a multi-meaning page. */
function senseSection(html: string, anchor: string) {
  const start = html.indexOf(`<section id="${anchor}"`);
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf('<section id="sense-', start + 1);
  return html.slice(start, next > start ? next : html.indexOf("<footer", start));
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is needed to list published items");
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  published = await sql<Published[]>`
    select i.slug, i.headword, s.definition
    from language_items i
    join senses s on s.item_id = i.id and s.position = (
      select min(position) from senses where item_id = i.id and status = 'published'
    )
    where i.status = 'published'
    order by i.slug
  `;
  await sql.end();
  expect(published.length).toBeGreaterThan(0);
});

describe("language pages", () => {
  it("gives every published item a page with its real content", async () => {
    const failures: string[] = [];
    for (const item of published) {
      const { status, html } = await page(`/language/${item.slug}`);
      if (status !== 200) failures.push(`${item.slug}: ${status}`);
      else if (!html.includes(`>${item.headword}</h1>`)) failures.push(`${item.slug}: heading`);
      else if (!html.includes(item.definition)) failures.push(`${item.slug}: definition`);
    }
    expect(failures).toEqual([]);
  });

  it("never sends a search result to a missing page", async () => {
    const slugs = new Set<string>();
    for (const query of SEARCHES) {
      const { html } = await page(`/explore?q=${encodeURIComponent(query)}`);
      for (const match of html.matchAll(/href="\/language\/([a-z0-9-]+)/g)) slugs.add(match[1]!);
    }
    expect(slugs.size).toBeGreaterThan(20);
    const missing: string[] = [];
    for (const slug of slugs) {
      if ((await page(`/language/${slug}`)).status !== 200) missing.push(slug);
    }
    expect(missing).toEqual([]);
  });

  it("returns a real 404 for an unknown slug", async () => {
    expect((await page("/language/not-a-real-item")).status).toBe(404);
  });

  it.each(["/language/significant", "/language/crucial", "/language/however"])(
    "%s shows no Phase 1 sample data",
    async (path) => {
      const { html } = await page(path);
      for (const text of SAMPLE_DATA) expect(html).not.toContain(text);
    },
  );

  it("keeps each meaning's relations with that meaning", async () => {
    const { html } = await page("/language/significant");
    expect(html).toContain("2 meanings");
    const notable = senseSection(html, "sense-notable");
    expect(notable).toContain("having a real effect");
    expect(notable).toContain(">considerable</a>");
    expect(notable).toContain("Considerable stresses size or amount");
    const statistical = senseSection(html, "sense-statistical");
    expect(statistical).toContain("in statistics");
    expect(statistical).not.toContain("Related language");
  });

  it("links related language to the meaning it relates to", async () => {
    const { html } = await page("/language/important");
    expect(html).toContain('href="/language/significant#sense-notable"');
    expect(html).not.toContain(">considerable</a>");
  });

  it("shows patterns and the mistake for responsible for", async () => {
    const { html } = await page("/language/responsible-for");
    expect(html).toContain("be responsible for + noun / -ing");
    expect(html).toContain("be responsible to + person / organisation");
    expect(html).toContain('Responsible takes "for" before the task or result.');
  });

  it("renders only the sections an item has", async () => {
    const analyse = (await page("/language/analyse")).html;
    expect(analyse).toContain("Also spelled");
    expect(analyse).toContain("(US)");
    expect(analyse).not.toContain("Related language");
    expect(analyse).not.toContain("Common collocations");

    const however = (await page("/language/however")).html;
    expect(however).toContain("How it links ideas");
    expect(however).toContain("Related language");
  });

  it("lets long phrases wrap instead of overflowing", async () => {
    const { html } = await page("/language/have-a-detrimental-effect-on");
    expect(html).toMatch(
      /<h1 class="[^"]*wrap-break-word[^"]*">have a detrimental effect on<\/h1>/,
    );
  });

  it("lists every published item in the sitemap", async () => {
    const { html: sitemap } = await page("/sitemap.xml");
    for (const item of published) expect(sitemap).toContain(`${ORIGIN}/language/${item.slug}<`);
  });
});
