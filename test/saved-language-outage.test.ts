import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * During a database outage Better Auth reports "no session". The save endpoints must answer 503
 * (the browser says "couldn't update"), not 401 (which would ask a signed-in learner to create an
 * account), and must not leak error details.
 */
const databaseUp = { value: true };

vi.mock("@/server/auth/session", () => ({ getRequestSession: async () => null }));
vi.mock("@/server/db/client", () => ({
  db: {
    execute: async () => {
      if (!databaseUp.value) throw new Error('connect ECONNREFUSED 127.0.0.1:5432 select "secret"');
      return [];
    },
  },
}));
vi.mock("@/server/repositories/saved-senses", () => ({
  saveSense: async () => "saved",
  removeSavedSense: async () => undefined,
  savedAmong: async () => [],
}));

const ORIGIN = "http://localhost:3000";

async function put() {
  const { PUT } = await import("@/app/api/bank/saved/[senseId]/route");
  return PUT(
    new Request(`${ORIGIN}/api/bank/saved/significant.notable`, {
      method: "PUT",
      headers: { origin: ORIGIN },
    }),
    { params: Promise.resolve({ senseId: "significant.notable" }) },
  );
}

async function get() {
  const { GET } = await import("@/app/api/bank/saved/route");
  return GET(new Request(`${ORIGIN}/api/bank/saved?senses=significant.notable`));
}

describe("saved language during a database outage", () => {
  beforeEach(() => {
    databaseUp.value = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("says unauthenticated when the database is up and there's no session", async () => {
    expect((await put()).status).toBe(401);
    expect((await get()).status).toBe(401);
  });

  it("says unavailable, without details, when the database is down", async () => {
    databaseUp.value = false;
    for (const response of [await put(), await get()]) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "unavailable" });
    }
  });
});
