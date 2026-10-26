import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

/**
 * Review over HTTP against a production build (Phase 5 Step 5): the practice page, the answer
 * endpoint's every refusal, an answer recorded and scheduled once, the bank agreeing, and the
 * learner's limit. Uses the second E2E learner and leaves nothing behind.
 *
 * `significant.notable` serves, in review order: `term:…:ex1` ("There was a ___ increase…",
 * answer "significant"), then `mistake:…:amount`, whose right version is option `b` at review 2.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;
const [, learner] = inject("learners");

const NOTABLE = "significant.notable";
const TERM = "term:significant.notable:ex1";
const AMOUNT = "mistake:significant.notable:amount";

function answer(body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${BASE_URL}/api/review/answers`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      cookie: learner.cookie,
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = (overrides: Record<string, unknown> = {}) => ({
  senseId: NOTABLE,
  exerciseId: TERM,
  expectedReviews: 0,
  answer: "significant",
  ...overrides,
});

async function page(path: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { cookie: learner.cookie },
    redirect: "manual",
  });
  return { status: response.status, html: (await response.text()).replaceAll("<!-- -->", "") };
}

let sql: ReturnType<typeof postgres>;
let userId = "";

async function reset() {
  await sql`delete from saved_senses where user_id = ${userId}`;
  await sql`delete from review_log where user_id = ${userId}`;
  await sql`delete from request_limits where user_id = ${userId}`;
}
const card = async () =>
  (
    await sql`select box, reviews, lapses from review_cards where user_id = ${userId} and sense_id = ${NOTABLE}`
  )[0];
const logCount = async () =>
  Number((await sql`select count(*)::int as n from review_log where user_id = ${userId}`)[0]!.n);

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

describe("practice", () => {
  it("is private", async () => {
    const response = await fetch(`${BASE_URL}/practice`, { redirect: "manual" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");

    const anonymous = await answer(valid(), { cookie: "" });
    expect(anonymous.status).toBe(401);
    const crossSite = await answer(valid(), { origin: "https://evil.example" });
    expect(crossSite.status).toBe(403);
    expect(await logCount()).toBe(0);
  });

  it("points to the Finder while nothing is saved", async () => {
    const { status, html } = await page("/practice");
    expect(status).toBe(200);
    expect(html).toContain("Nothing to review yet");
    expect(html).toContain("Save language from the Finder to start reviewing it.");
    expect(html).toContain('href="/finder"');
    expect(html).not.toContain("Sample session");
  });

  it("shows a saved meaning's first exercise, without its answer key", async () => {
    const saved = await fetch(`${BASE_URL}/api/bank/saved/${NOTABLE}`, {
      method: "PUT",
      headers: { origin: ORIGIN, cookie: learner.cookie },
    });
    expect(saved.status).toBe(200);
    const { html } = await page("/practice");
    expect(html).toContain("Review 1 of 1");
    expect(html).toMatch(/<h1[^>]*>Complete the sentence<\/h1>/);
    // Why practice selection chose it (Phase 7.3), under the heading.
    expect(html).toMatch(/<\/h1><p[^>]*>Not practised yet\.<\/p>/);
    expect(html).toContain(
      "Missing word in: There was a … increase in the number of cyclists between 2010 and 2020.",
    );
    expect(html).toContain(TERM);
    // The key stays on the server: the authored also-correct answer appears nowhere.
    expect(html).not.toContain("substantial");
  });

  it("checks and records an answer once, and schedules it", async () => {
    const first = await answer(valid({ answer: " Significant " }));
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toMatchObject({
      duplicate: false,
      outcome: "correct",
      match: "expected",
      expected: "significant",
      accepted: ["substantial"],
      term: "significant",
      href: "/language/significant#sense-notable",
      nextReview: { due: false, days: 1 },
    });

    // A retry gets the stored result and changes nothing.
    const retry = await answer(valid());
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ duplicate: true, outcome: "correct" });
    expect(await logCount()).toBe(1);
    expect(await card()).toEqual({ box: 1, reviews: 1, lapses: 0 });
  });

  it("is caught up afterwards, and the bank agrees", async () => {
    const practice = await page("/practice");
    expect(practice.html).toContain("Nothing is due right now");
    expect(practice.html).toContain("Your next review is in 1 day.");
    expect(practice.html).toContain('href="/bank"');

    const bank = await page("/bank");
    expect(bank.html).toMatch(/data-slot="status-badge"[^>]*>.*?Learning/);
    expect(bank.html).toContain("Next review in 1 day");
    expect(bank.html).not.toContain("Start review");
  });

  it("refuses answers that aren't the next one, and records nothing", async () => {
    // Review 1 is used; review 2 isn't due until tomorrow.
    expect((await answer(valid({ exerciseId: AMOUNT }))).status).toBe(409);
    const notDue = await answer(valid({ exerciseId: AMOUNT, expectedReviews: 1, answer: "b" }));
    expect(notDue.status).toBe(409);
    expect(await notDue.json()).toEqual({ error: "not_due" });

    const unsaved = await answer(
      valid({ senseId: "crucial.essential", exerciseId: "term:crucial.essential:ex1" }),
    );
    expect(unsaved.status).toBe(404);

    for (const body of [
      "not json",
      "x".repeat(3000),
      valid({ userId: "someone-else" }),
      valid({ correct: true }),
      valid({ exerciseId: "hint:significant.notable" }),
      valid({ answer: "x".repeat(81) }),
      valid({ expectedReviews: -1 }),
    ]) {
      const response = await answer(body);
      expect(response.status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
    expect(await logCount()).toBe(1);
  });

  it("records a wrong choice, explains it, and sends the card back to box 1", async () => {
    await sql`update review_cards set due_at = now() - interval '1 hour'
              where user_id = ${userId} and sense_id = ${NOTABLE}`;
    const bank = await page("/bank");
    expect(bank.html).toContain("Start review");

    const { html } = await page("/practice");
    expect(html).toMatch(/<h1[^>]*>Which is correct\?<\/h1><p[^>]*>Due for review\.<\/p>/);
    expect(html).toContain("a significant amount of people");
    expect(html).toContain("a significant number of people");

    const wrong = await answer(valid({ exerciseId: AMOUNT, expectedReviews: 1, answer: "a" }));
    expect(wrong.status).toBe(200);
    const feedback = await wrong.json();
    expect(feedback).toMatchObject({
      outcome: "incorrect",
      match: "mistake",
      expected: "a significant number of people",
      nextReview: { due: false, days: 1 },
    });
    expect(feedback.explanation).toEqual(expect.any(String));
    expect(await card()).toEqual({ box: 1, reviews: 2, lapses: 1 });
    expect(await logCount()).toBe(2);
  });

  it("selects a missed meaning with its reason once it's due again", async () => {
    // Not due until tomorrow: practice selection doesn't take it early (no early reviews).
    expect((await page("/practice")).html).toContain("Nothing is due right now");
    await sql`update review_cards set due_at = now() - interval '1 hour'
              where user_id = ${userId} and sense_id = ${NOTABLE}`;
    const { html } = await page("/practice");
    expect(html).toMatch(/<\/h1><p[^>]*>Missed last time\.<\/p>/);
    expect(html).not.toContain("Due for review.");
  });

  it("limits a learner to 30 answers a minute", async () => {
    await sql`delete from request_limits where user_id = ${userId}`;
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await answer({})).status);
    expect(statuses.slice(0, 30).every((status) => status === 400)).toBe(true);
    const limited = await answer({});
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect(statuses[30]).toBe(429);
    await sql`delete from request_limits where user_id = ${userId}`;
  });
});
