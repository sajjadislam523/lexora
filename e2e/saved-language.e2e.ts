import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

/**
 * Persistent, sense-level saving over HTTP against a real server and PostgreSQL — the requests
 * the save buttons make, and the pages they live on. "Refresh" is a fresh request: nothing is
 * kept anywhere but the database.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE_URL).origin;
const [alice, bob] = inject("learners");

const NOTABLE = "significant.notable";
const STATISTICAL = "significant.statistical";

function change(method: "PUT" | "DELETE", senseId: string, cookie?: string) {
  return fetch(`${BASE_URL}/api/bank/saved/${senseId}`, {
    method,
    headers: { origin: ORIGIN, ...(cookie && { cookie }) },
  });
}

/** A fresh request for saved state, as the page makes after every load. */
async function savedNow(cookie: string, senses = [NOTABLE, STATISTICAL]) {
  const response = await fetch(`${BASE_URL}/api/bank/saved?senses=${senses.join(",")}`, {
    headers: { cookie },
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { saved: string[] }).saved.sort();
}

async function html(path: string, cookie?: string) {
  const response = await fetch(`${BASE_URL}${path}`, { headers: cookie ? { cookie } : {} });
  expect(response.status).toBe(200);
  return (await response.text()).replaceAll("<!-- -->", "");
}

let sql: ReturnType<typeof postgres>;
const rowCount = async () =>
  (await sql`select count(*)::int as n from saved_senses`)[0]!.n as number;

beforeAll(() => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
});

afterAll(async () => {
  await sql.end();
});

describe("saving language", () => {
  it("A: a saved sense is still saved on a fresh request", async () => {
    const response = await change("PUT", NOTABLE, alice.cookie);
    expect(await response.json()).toEqual({ senseId: NOTABLE, saved: true });
    expect(await savedNow(alice.cookie)).toEqual([NOTABLE]);
    expect(await savedNow(alice.cookie)).toEqual([NOTABLE]);
  });

  it("B: an unsaved sense stays unsaved on a fresh request", async () => {
    const response = await change("DELETE", NOTABLE, alice.cookie);
    expect(await response.json()).toEqual({ senseId: NOTABLE, saved: false });
    expect(await savedNow(alice.cookie)).toEqual([]);
  });

  it("C: each meaning of significant is saved on its own", async () => {
    await change("PUT", NOTABLE, alice.cookie);
    expect(await savedNow(alice.cookie)).toEqual([NOTABLE]);
    await change("PUT", STATISTICAL, alice.cookie);
    expect(await savedNow(alice.cookie)).toEqual([NOTABLE, STATISTICAL]);
    await change("DELETE", NOTABLE, alice.cookie);
    expect(await savedNow(alice.cookie)).toEqual([STATISTICAL]);
    await change("DELETE", STATISTICAL, alice.cookie);
  });

  it("C: the page offers one save per meaning, each naming its meaning", async () => {
    const page = await html("/language/significant");
    expect(page).toContain("Each meaning is saved on its own");
    expect(page).toContain(
      'aria-label="Save “significant — having a real effect” to your language bank"',
    );
    expect(page).toContain('aria-label="Save “significant — in statistics” to your language bank"');
    expect(page).not.toContain('aria-label="Save “significant” to your language bank"');
  });

  it("C: a collocation result saves the meaning it belongs to", async () => {
    const page = await html(`/explore?q=${encodeURIComponent("collocations with significant")}`);
    expect(page).toContain(
      'aria-label="Save “significant — having a real effect” to your language bank"',
    );
  });

  it("D: a visitor can't save, and nothing is stored", async () => {
    const before = await rowCount();
    expect((await change("PUT", NOTABLE)).status).toBe(401);
    expect((await fetch(`${BASE_URL}/api/bank/saved?senses=${NOTABLE}`)).status).toBe(401);
    expect(await rowCount()).toBe(before);
  });

  it("D: language pages are identical for visitors and learners, with no saved state inside", async () => {
    await change("PUT", NOTABLE, alice.cookie);
    const [visitor, learner] = await Promise.all([
      html("/language/significant"),
      html("/language/significant", alice.cookie),
    ]);
    expect(learner).toBe(visitor);
    expect(learner).not.toContain(alice.email);
    expect(learner).not.toContain('aria-pressed="true"');
    await change("DELETE", NOTABLE, alice.cookie);
  });

  it("E: one learner's saves are invisible to and untouchable by another", async () => {
    await change("PUT", "crucial.essential", alice.cookie);
    expect(await savedNow(bob.cookie, ["crucial.essential"])).toEqual([]);

    await change("DELETE", "crucial.essential", bob.cookie);
    expect(await savedNow(alice.cookie, ["crucial.essential"])).toEqual(["crucial.essential"]);

    await change("PUT", "crucial.essential", bob.cookie);
    await change("DELETE", "crucial.essential", alice.cookie);
    expect(await savedNow(bob.cookie, ["crucial.essential"])).toEqual(["crucial.essential"]);
    expect(await savedNow(alice.cookie, ["crucial.essential"])).toEqual([]);
    await change("DELETE", "crucial.essential", bob.cookie);
  });

  it("shows the learner's real saved count on the dashboard", async () => {
    await change("PUT", "important.main", alice.cookie);
    expect(await html("/home", alice.cookie)).toContain("1 meaning saved");
    await change("DELETE", "important.main", alice.cookie);
    expect(await html("/home", alice.cookie)).toContain("0 meanings saved");
  });
});
