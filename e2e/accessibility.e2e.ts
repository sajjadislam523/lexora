import { describe, expect, inject, it } from "vitest";

/**
 * Structural accessibility of every page, from the HTML the production server sends: one h1,
 * named buttons and links, labelled form fields, unique ids, labelled landmarks, image text.
 * These are the regressions an HTML check can catch; layout (overflow at each width), focus
 * visibility and keyboard behaviour are checked in the browser (see docs/DESIGN.md §12).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const [learner] = inject("learners");

const PUBLIC = [
  "/",
  "/explore",
  "/explore?q=important",
  "/explore?q=preposition+after+responsible",
  "/explore?q=signficant",
  "/explore?q=xyzzyplugh",
  "/language/significant",
  "/language/responsible-for",
  "/language/have-a-detrimental-effect-on",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

const PERSONAL = [
  "/home",
  "/finder",
  "/finder?q=important",
  "/bank",
  "/practice",
  "/writing",
  "/speaking",
  "/progress",
  "/settings",
];

async function html(path: string, cookie?: string) {
  const response = await fetch(`${BASE_URL}${path}`, { headers: cookie ? { cookie } : {} });
  expect(response.status, path).toBe(200);
  return (await response.text()).replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * The page as first painted, without the streamed replacements Next.js appends in hidden
 * `<div hidden id="S:…">` segments (they replace Suspense fallbacks already in the shell).
 */
function split(page: string) {
  const [shell = "", ...segments] = page.split(/<div hidden id="S:\d+">/);
  return { shell, streamed: segments.join("") };
}

const attr = (attrs: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];

const text = (inner: string) =>
  inner
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, "x")
    .replace(/\s+/g, " ")
    .trim();

function problems(page: string) {
  const { shell, streamed } = split(page);
  const found: string[] = [];

  const h1 = (shell.match(/<h1\b/g) ?? []).length || (streamed.match(/<h1\b/g) ?? []).length;
  if (h1 !== 1) found.push(`${h1} h1 elements`);

  for (const [, attrs = "", inner = ""] of shell.matchAll(
    /<button\b([^>]*)>([\s\S]*?)<\/button>/g,
  )) {
    if (!attr(attrs, "aria-label") && !attr(attrs, "aria-labelledby") && !text(inner))
      found.push(`unnamed button ${attrs.slice(0, 80)}`);
  }
  for (const [, attrs = "", inner = ""] of shell.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    if (!attr(attrs, "href")) continue;
    const img = /<img[^>]*\salt="([^"]+)"/.exec(inner)?.[1];
    if (!attr(attrs, "aria-label") && !attr(attrs, "aria-labelledby") && !text(inner) && !img)
      found.push(`unnamed link ${attr(attrs, "href")}`);
  }

  const labelled = new Set(
    [...shell.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map(([, id]) => id),
  );
  for (const match of shell.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const [, tag, attrs = ""] = match;
    if (attr(attrs, "type") === "hidden") continue;
    const id = attr(attrs, "id");
    const before = shell.slice(0, match.index);
    const insideLabel = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
    const named =
      (id && labelled.has(id)) ||
      attr(attrs, "aria-label") ||
      attr(attrs, "aria-labelledby") ||
      insideLabel;
    if (!named) found.push(`unlabelled ${tag} ${id ?? attrs.slice(0, 60)}`);
  }

  const ids = [...shell.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i)))
    found.push(`duplicate id ${id}`);

  for (const [, attrs = ""] of shell.matchAll(/<img\b([^>]*)>/g))
    if (attr(attrs, "alt") === undefined) found.push(`image without alt`);

  const navs = [...shell.matchAll(/<nav\b([^>]*)>/g)].map(([, attrs = ""]) => attrs);
  if (navs.length > 1)
    for (const attrs of navs)
      if (!attr(attrs, "aria-label") && !attr(attrs, "aria-labelledby"))
        found.push("unlabelled nav among several");

  if (!/<main\b/.test(shell)) found.push("no main landmark");
  if (!/<html[^>]*\slang="en/.test(shell)) found.push("no document language");
  return found;
}

describe("accessibility of the HTML every page sends", () => {
  it.each(PUBLIC)("%s", async (path) => {
    expect(problems(await html(path))).toEqual([]);
  });

  it.each(PERSONAL)("%s (signed in)", async (path) => {
    expect(problems(await html(path, learner.cookie))).toEqual([]);
  });

  it("names overlay triggers as opening a dialog", async () => {
    const home = await html("/home", learner.cookie);
    expect(home).toMatch(
      /aria-label="Open navigation"[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"|aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*aria-label="Open navigation"/,
    );
    const landing = await html("/");
    expect(landing).toMatch(/aria-label="Open menu"/);
    expect(landing).toMatch(/aria-haspopup="dialog"/);
  });

  it("marks only the screens that show sample data as a prototype", async () => {
    const badge = /data-slot="badge"[^>]*>Prototype</;
    for (const path of ["/home", "/practice"])
      expect(await html(path, learner.cookie), path).toMatch(badge);
    for (const path of ["/finder", "/settings", "/bank"])
      expect(await html(path, learner.cookie), path).not.toMatch(badge);
    expect(await html("/finder", learner.cookie)).not.toContain("nothing is saved");
  });

  it("keeps each meaning's save button separate and named for that meaning", async () => {
    const page = await html("/language/significant");
    expect(page).toContain("Each meaning is saved on its own");
    const labels = [...page.matchAll(/aria-label="(Save “significant — [^"]+)"/g)].map(
      ([, label]) => label,
    );
    expect(labels).toEqual([
      "Save “significant — having a real effect” to your language bank",
      "Save “significant — in statistics” to your language bank",
    ]);
  });
});
