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
    expect(html).toContain("1 meaning · 1 new");
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
    expect(html).toContain("2 meanings · 2 new");
    expect(html).toContain("crucial");
  });

  it("shows a card's next review once it has been answered", async () => {
    await sql`update review_cards set box = 4, reviews = 4, due_at = now() + interval '9 days 1 hour'
              where user_id = ${userId} and sense_id = ${NOTABLE}`;
    const { html } = await bank();
    expect(html).toContain("2 meanings · 1 new · 1 known");
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
    expect(html).toContain("1 meaning · 1 new");
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

  it("shows no one's saves to a visitor", async () => {
    await change("PUT", NOTABLE);
    const response = await fetch(`${BASE_URL}/bank`, { redirect: "manual" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
    expect(await response.text()).not.toContain("having a real effect");
  });
});
