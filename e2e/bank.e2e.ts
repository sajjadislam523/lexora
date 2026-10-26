import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

/**
 * The language bank over HTTP against a production build (Phase 5 Step 4): what a learner's
 * saves look like there, the save-flow endpoints keeping the bank and the Finder in agreement,
 * and that nobody else sees them. Uses the second E2E learner and leaves nothing behind.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;
const [, learner] = inject("learners");

const NOTABLE = "significant.notable";
const CRUCIAL = "crucial.essential";

function change(method: "PUT" | "DELETE", senseId: string) {
  return fetch(`${BASE_URL}/api/bank/saved/${senseId}`, {
    method,
    headers: { origin: ORIGIN, cookie: learner.cookie },
  });
}

async function bank(path = "/bank") {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { cookie: learner.cookie },
    redirect: "manual",
  });
  return {
    status: response.status,
    location: response.headers.get("location"),
    html: (await response.text()).replaceAll("<!-- -->", ""),
  };
}

/**
 * The learning-state filters as rendered: each chip's label, count, URL and whether it's the
 * current view, in order.
 */
function chips(html: string) {
  return [...html.matchAll(/<a([^>]*data-slot="filter-chip"[^>]*)>(.*?)<\/a>/g)].map(
    ([, attributes = "", inner = ""]) => ({
      label: inner.replace(/<span class="sr-only">, <\/span>.*$/, ""),
      count: Number(/<span[^>]*>(\d+)<\/span>$/.exec(inner)?.[1]),
      href: /href="([^"]*)"/.exec(attributes)?.[1]?.replaceAll("&amp;", "&"),
      current: attributes.includes('aria-current="page"'),
    }),
  );
}

/** The chips' counts by label: { All: 2, New: 1, Learning: 0, Known: 1, Due: 1 }. */
const counts = (html: string) => Object.fromEntries(chips(html).map((c) => [c.label, c.count]));

let sql: ReturnType<typeof postgres>;
let userId = "";

async function reset() {
  await sql`delete from saved_senses where user_id = ${userId}`;
  await sql`delete from request_limits where user_id = ${userId}`;
}

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const [row] = await sql`select id from users where email = ${learner.email}`;
  userId = row!.id as string;
  await reset();
});

afterAll(async () => {
  await reset();
  await sql.end();
});

describe("language bank", () => {
  it("is empty, and points to the Finder, before anything is saved", async () => {
    const { status, html } = await bank();
    expect(status).toBe(200);
    expect(html).toContain("Language bank");
    expect(html).toContain("Your language bank is empty");
    expect(html).toContain('href="/finder"');
  });

  it("lists a saved meaning with its meaning, example, status and next review", async () => {
    expect((await change("PUT", NOTABLE)).status).toBe(200);
    const { html } = await bank();
    expect(html).toContain("Ready to review");
    expect(chips(html)).toEqual([
      { label: "All", count: 1, href: "/bank", current: true },
      { label: "New", count: 1, href: "/bank?show=new", current: false },
      { label: "Learning", count: 0, href: "/bank?show=learning", current: false },
      { label: "Known", count: 0, href: "/bank?show=known", current: false },
      { label: "Due", count: 1, href: "/bank?show=due", current: false },
    ]);
    expect(html).toContain('<nav aria-label="Filter by learning state">');
    expect(html).toContain("significant");
    expect(html).toContain("having a real effect");
    expect(html).toContain("Large or important enough to have a noticeable effect.");
    expect(html).toContain("in the number of cyclists");
    expect(html).toMatch(/data-slot="status-badge"[^>]*>.*?New/);
    expect(html).toContain("Due now");
    expect(html).toContain('href="/language/significant#sense-notable"');
    expect(html).toContain(
      'aria-label="Remove “significant (having a real effect)” from your language bank"',
    );
  });

  it("shows a save made before Phase 5 (no card) as new", async () => {
    await sql`insert into saved_senses (user_id, sense_id) values (${userId}, ${CRUCIAL})`;
    const cards =
      await sql`select 1 from review_cards where user_id = ${userId} and sense_id = ${CRUCIAL}`;
    expect(cards).toHaveLength(0);
    const { html } = await bank();
    expect(counts(html)).toEqual({ All: 2, New: 2, Learning: 0, Known: 0, Due: 2 });
    expect(html).toContain("crucial");
  });

  it("shows a card's next review once it has been answered", async () => {
    await sql`update review_cards set box = 4, reviews = 4, due_at = now() + interval '9 days 1 hour'
              where user_id = ${userId} and sense_id = ${NOTABLE}`;
    const { html } = await bank();
    expect(counts(html)).toEqual({ All: 2, New: 1, Learning: 0, Known: 1, Due: 1 });
    expect(html).toContain("Coming up");
    expect(html).toMatch(/data-slot="status-badge"[^>]*>.*?Known/);
    expect(html).toContain("Next review in 10 days");
  });

  it("agrees with the Finder about what is saved, and empties when everything is removed", async () => {
    const savedNow = async () => {
      const response = await fetch(`${BASE_URL}/api/bank/saved?senses=${NOTABLE},${CRUCIAL}`, {
        headers: { cookie: learner.cookie },
      });
      return ((await response.json()) as { saved: string[] }).saved.sort();
    };
    expect(await savedNow()).toEqual([CRUCIAL, NOTABLE]);

    expect((await change("DELETE", NOTABLE)).status).toBe(200);
    expect(await savedNow()).toEqual([CRUCIAL]);
    const { html } = await bank();
    expect(counts(html)).toEqual({ All: 1, New: 1, Learning: 0, Known: 0, Due: 1 });
    expect(html).not.toContain("having a real effect");

    expect((await change("DELETE", CRUCIAL)).status).toBe(200);
    expect(await savedNow()).toEqual([]);
    expect((await bank()).html).toContain("Your language bank is empty");
  });

  it("has one URL per page", async () => {
    for (const path of ["/bank?page=1", "/bank?page=abc", "/bank?page=0", "/bank?page=7"]) {
      const { status, location } = await bank(path);
      expect([307, 308], path).toContain(status);
      expect(
        new URL(location!, BASE_URL).pathname + new URL(location!, BASE_URL).search,
        path,
      ).toBe("/bank");
    }
  });

  it("shows each row's learning stage, whether it's due, and why", async () => {
    await reset();
    await change("PUT", NOTABLE);
    await change("PUT", CRUCIAL);
    // NOTABLE: missed twice, due again. CRUCIAL: known, and due.
    const [notable] = await sql`
      update review_cards set box = 1, reviews = 2, lapses = 2, due_at = now() - interval '1 hour'
      where user_id = ${userId} and sense_id = ${NOTABLE} returning id`;
    const [crucial] = await sql`
      update review_cards set box = 4, reviews = 4, lapses = 0, due_at = now() - interval '1 hour'
      where user_id = ${userId} and sense_id = ${CRUCIAL} returning id`;
    const log = (cardId: string, senseId: string, outcomes: string[]) =>
      sql`insert into review_log ${sql(
        outcomes.map((outcome, i) => ({
          user_id: userId,
          card_id: cardId,
          sense_id: senseId,
          review_number: i + 1,
          exercise_id: `mistake:${senseId}:e2e`,
          exercise_type: "mistake",
          outcome,
          answer_match: outcome === "correct" ? "expected" : "mistake",
          expected: "right",
          box_before: 0,
          box_after: 1,
          due_after: new Date(),
          reviewed_at: new Date(Date.now() - (outcomes.length - i) * 86_400_000),
        })),
      )}`;
    await log(notable!.id as string, NOTABLE, ["incorrect", "incorrect"]);
    await log(crucial!.id as string, CRUCIAL, ["correct", "correct", "correct", "correct"]);

    const { html } = await bank();
    expect(counts(html)).toEqual({ All: 2, New: 0, Learning: 1, Known: 1, Due: 2 });
    // The badge is the stage; "Due now" says it's due, in words.
    expect(html).toMatch(/data-slot="status-badge"[^>]*>.*?Learning<\/span>.*?Due now/);
    expect(html).toMatch(/data-slot="status-badge"[^>]*>.*?Known<\/span>.*?Due now/);
    expect(html).not.toMatch(/data-slot="status-badge"[^>]*>(?:(?!<\/span>).)*<\/span>Due</);
    expect(html).toContain("Missed the last 2 times.");
    expect(html).toContain("Answered correctly the last 4 times.");
    // Already said by the reason.
    expect(html).not.toContain("Missed 2 times");
  });

  it("filters by learning stage and by due, each at its own URL", async () => {
    const due = await bank("/bank?show=due");
    expect(due.status).toBe(200);
    expect(chips(due.html).find((c) => c.current)?.label).toBe("Due");
    expect(due.html).toContain("having a real effect");
    expect(due.html).toContain("crucial");

    const learning = (await bank("/bank?show=learning")).html;
    expect(learning).toContain("having a real effect");
    expect(learning).not.toContain('href="/language/crucial');

    const known = (await bank("/bank?show=known")).html;
    expect(known).toContain('href="/language/crucial');
    expect(known).not.toContain("having a real effect");

    const empty = (await bank("/bank?show=new")).html;
    expect(empty).toContain("No new meanings right now.");
    expect(empty).toMatch(/<a[^>]*href="\/bank"[^>]*>Show all<\/a>/);
    expect(empty).not.toContain("having a real effect");
  });

  it("has one URL per filtered page", async () => {
    const cases: [string, string][] = [
      ["/bank?show=all", "/bank"],
      ["/bank?show=bogus", "/bank"],
      ["/bank?show=due&show=new", "/bank?show=due"],
      ["/bank?show=due&page=1", "/bank?show=due"],
      ["/bank?page=2&show=due", "/bank?show=due&page=2"],
      ["/bank?show=due&page=9", "/bank?show=due"],
      ["/bank?show=known&utm=x", "/bank?show=known"],
    ];
    for (const [path, expected] of cases) {
      const { status, location } = await bank(path);
      expect([307, 308], path).toContain(status);
      const url = new URL(location!, BASE_URL);
      expect(url.pathname + url.search, path).toBe(expected);
    }
  });

  it("shows no one's saves to a visitor", async () => {
    await change("PUT", NOTABLE);
    const response = await fetch(`${BASE_URL}/bank`, { redirect: "manual" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
    expect(await response.text()).not.toContain("having a real effect");
  });
});
