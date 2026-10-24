import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

/**
 * Personal mistake evidence over HTTP against a production build (Phase 5 Step 6; spec §16): one
 * wrong answer is not evidence; the same mistake again within 30 days is, in the answer's
 * feedback and in the bank, and a retry doesn't count it twice. Only its learner sees it. Uses
 * the second E2E learner; time moves by making the card due, never by waiting.
 *
 * `significant.notable` serves `term:…:ex1`, `mistake:…:amount`, then `term:…:ex2`. Typing
 * "significance" in either completion is the authored mistake `significant.notable:significance`.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;
const [other, learner] = inject("learners");

const NOTABLE = "significant.notable";
const NOTE = "You’ve made this mistake 2 times in the last 30 days.";

function answer(exerciseId: string, expectedReviews: number, given: string) {
  return fetch(`${BASE_URL}/api/review/answers`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: learner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ senseId: NOTABLE, exerciseId, expectedReviews, answer: given }),
  });
}

async function bank(cookie = learner.cookie) {
  const response = await fetch(`${BASE_URL}/bank`, { headers: { cookie } });
  return (await response.text()).replaceAll("<!-- -->", "");
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
  const saved = await fetch(`${BASE_URL}/api/bank/saved/${NOTABLE}`, {
    method: "PUT",
    headers: { origin: ORIGIN, cookie: learner.cookie },
  });
  expect(saved.status).toBe(200);
});

afterAll(async () => {
  await reset();
  await sql.end();
});

describe("personal mistake evidence", () => {
  it("isn't evidence after one wrong answer", async () => {
    const first = await answer("term:significant.notable:ex1", 0, "significance");
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      outcome: "incorrect",
      match: "mistake",
      evidence: null,
    });
    const page = await bank();
    expect(page).not.toContain("Your mistake");
    expect(page).not.toContain("Missed");
  });

  it("is evidence when the same mistake comes back within 30 days", async () => {
    await makeDue();
    const between = await answer("mistake:significant.notable:amount", 1, "b");
    expect(await between.json()).toMatchObject({ outcome: "correct", evidence: null });

    await makeDue();
    const again = await answer("term:significant.notable:ex2", 2, "significance");
    expect(again.status).toBe(200);
    const evidence = {
      kind: "authored",
      wrong: "This decision is very significance.",
      right: "This decision is very significant.",
      times: 2,
    };
    expect(await again.json()).toMatchObject({ outcome: "incorrect", evidence });

    // A retry returns the same result: still two times, still three answers.
    const retry = await answer("term:significant.notable:ex2", 2, "significance");
    expect(await retry.json()).toMatchObject({ duplicate: true, evidence });
    const [{ n }] =
      (await sql`select count(*)::int as n from review_log where user_id = ${userId}`) as [
        { n: number },
      ];
    expect(n).toBe(3);
  });

  it("shows in the learner's bank, and nobody else's", async () => {
    const page = await bank();
    expect(page).toContain("Your mistake");
    expect(page).toContain("This decision is very significance.");
    expect(page).toContain(NOTE);
    expect(page).toContain("Missed 2 times");

    const theirs = await bank(other.cookie);
    expect(theirs).not.toContain(NOTE);
    expect(theirs).not.toContain("This decision is very significance.");
  });
});
