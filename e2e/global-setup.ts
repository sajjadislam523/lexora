import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import postgres from "postgres";
import type { TestProject } from "vitest/node";

/**
 * Two throwaway learners for the whole E2E run, signed up once over HTTP (sign-up is rate limited
 * to three a minute) and deleted afterwards. Tests read them with `inject("learners")`.
 */
export type Learner = { email: string; cookie: string };

declare module "vitest" {
  export interface ProvidedContext {
    learners: [Learner, Learner];
  }
}

// Locally the database comes from .env.local (as in test/setup.ts); in CI from the workflow.
if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function signUp(name: string): Promise<Learner> {
  const email = `e2e-${randomUUID()}@lexora.test`;
  const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(BASE_URL).origin },
    body: JSON.stringify({ name, email, password: randomBytes(12).toString("hex") }),
  });
  if (response.status !== 200) throw new Error(`E2E sign-up failed: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .filter((c) => c.includes("session_token"))
    .join("; ");
  if (!cookie) throw new Error("E2E sign-up returned no session cookie");
  return { email, cookie };
}

export default async function setup(project: TestProject) {
  const learners: [Learner, Learner] = [
    await signUp("E2E Learner A"),
    await signUp("E2E Learner B"),
  ];
  project.provide("learners", learners);

  return async () => {
    if (!process.env.DATABASE_URL) return;
    const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
    await sql`delete from users where email in ${sql(learners.map((l) => l.email))}`;
    await sql.end();
  };
}
