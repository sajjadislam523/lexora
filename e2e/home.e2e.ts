import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

/**
 * Home over HTTP against a production build (Phase 5 Step 7; spec §18): a first-use Home with
 * nothing invented, then the learner's real counts, the review call to action, the next review
 * and a recurring mistake — shown to that learner only. Uses the second E2E learner; time moves
 * by making the card due, never by waiting. Exercises of `significant.notable`: see
 * e2e/mistake-evidence.e2e.ts.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;
const [other, learner] = inject("learners");

const NOTABLE = "significant.notable";
const NOTE = "You’ve made this mistake 2 times in the last 30 days.";

async function home(cookie = learner.cookie) {
  const response = await fetch(`${BASE_URL}/home`, { headers: { cookie } });
  expect(response.status).toBe(200);
  return (await response.text()).replaceAll("<!-- -->", "");
}

function answer(exerciseId: string, expectedReviews: number, given: string) {
  return fetch(`${BASE_URL}/api/review/answers`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: learner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ senseId: NOTABLE, exerciseId, expectedReviews, answer: given }),
  });
}

let sql: ReturnType<typeof postgres>;
let userId = "";

async function reset() {
  await sql`delete from saved_senses where user_id = ${userId}`;
  await sql`delete from review_log where user_id = ${userId}`;
  await sql`delete from request_limits where user_id = ${userId}`;
}
const makeDue = () =>
  sql`update review_cards set due_at = now() - interval '1 minute'
      where user_id = ${userId} and sense_id = ${NOTABLE}`;

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

describe("home", () => {
  it("starts a new learner at the Finder, with nothing invented", async () => {
    const page = await home();
    expect(page).toContain("Welcome to Lexora");
    expect(page).toContain("Save language from the Finder to start reviewing it.");
    expect(page).toContain("Start your language bank");
    expect(page).toContain('href="/finder"');
    for (const invented of ["Sample learner data", "Today’s focus", "reviewed today", "minutes"]) {
      expect(page, invented).not.toContain(invented);
    }
    expect(page).not.toContain("Start review");
    expect(page).not.toContain("Recurring mistakes");
  });

  it("lists Progress nowhere in the navigation, though its page stays", async () => {
    const page = await home();
    expect(page).not.toContain('href="/progress"');
    for (const href of ["/home", "/finder", "/bank", "/practice"]) {
      expect(page, href).toContain(`href="${href}"`);
    }
    const progress = await fetch(`${BASE_URL}/progress`, { headers: { cookie: learner.cookie } });
    expect(progress.status).toBe(200);
  });

  it("shows what is ready, the bank and the latest save", async () => {
    const saved = await fetch(`${BASE_URL}/api/bank/saved/${NOTABLE}`, {
      method: "PUT",
      headers: { origin: ORIGIN, cookie: learner.cookie },
    });
    expect(saved.status).toBe(200);
    const page = await home();
    expect(page).toContain("Welcome back");
    expect(page).toContain("1 meaning is ready to review.");
    expect(page).toContain("1 meaning ready now");
    expect(page).toMatch(/href="\/practice"[^>]*>Start review/);
    expect(page).toContain("1 saved");
    expect(page).toContain("1 meaning saved");
    expect(page).toContain('href="/bank"');
    expect(page).toContain("Recently saved");
    expect(page).toContain('href="/language/significant#sense-notable"');
    expect(page).toMatch(/data-slot="status-badge"[^>]*>.*?New/);
  });

  it("names the next review once nothing is due", async () => {
    expect((await answer("term:significant.notable:ex1", 0, "significance")).status).toBe(200);
    const page = await home();
    expect(page).toContain("Nothing is due right now. Your next review is in 1 day.");
    expect(page).not.toContain("Start review");
    expect(page).not.toContain("Recurring mistakes"); // one wrong answer isn't one
  });

  it("shows a recurring mistake to its learner only", async () => {
    await makeDue();
    expect((await answer("mistake:significant.notable:amount", 1, "b")).status).toBe(200);
    await makeDue();
    expect((await answer("term:significant.notable:ex2", 2, "significance")).status).toBe(200);

    const page = await home();
    expect(page).toContain("Recurring mistakes");
    expect(page).toContain("This decision is very significance.");
    expect(page).toContain(NOTE);
    expect(page).toContain("Open “significant”");

    const theirs = await home(other.cookie);
    expect(theirs).not.toContain(NOTE);
    expect(theirs).not.toContain("This decision is very significance.");
  });
});
