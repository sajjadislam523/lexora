import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateExercises, type PracticeMaterial } from "@/learning/exercises";

import { loadPublishedContent } from "./published-content";
import { createTempDatabase } from "./temp-database";

/**
 * Practice material from PostgreSQL (what review sessions will read) equals the material built
 * from content/ before import (what the inventory and content:check use), sense for sense, and
 * so do the exercises generated from it. Skipped without a database.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("practice material (PostgreSQL)", () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  let load: (ids: readonly string[]) => Promise<PracticeMaterial[]>;
  let built: PracticeMaterial[];

  beforeAll(async () => {
    temp = await createTempDatabase();
    const { importContent } = await import("@/server/content/import");
    const { buildRows } = await import("@/server/content/build");
    const { practiceMaterialFromContent } = await import("@/server/content/practice");
    const { loadPracticeMaterial } = await import("@/server/repositories/language/practice");
    const content = await loadPublishedContent();
    await importContent(temp.db, content);
    built = practiceMaterialFromContent(buildRows(content));
    load = (ids) => loadPracticeMaterial(temp.db, ids);
  });

  afterAll(async () => {
    await temp?.drop();
  });

  it("reads every published sense exactly as built from content/", async () => {
    const ids = built.map((m) => m.senseId);
    expect(await load(ids)).toEqual(built);
  });

  it("generates the same exercises from either", async () => {
    const fromDatabase = await load(built.map((m) => m.senseId));
    for (const [i, material] of fromDatabase.entries()) {
      expect(generateExercises(material, 3)).toEqual(generateExercises(built[i]!, 3));
    }
  });

  it("returns the senses asked for, in that order, skipping unknown ones", async () => {
    const asked = [
      "significant.statistical",
      "nope.nope",
      "significant.notable",
      "significant.statistical",
    ];
    const loaded = await load(asked);
    expect(loaded.map((m) => m.senseId)).toEqual([
      "significant.statistical",
      "significant.notable",
      "significant.statistical",
    ]);
    // Both senses of "significant" keep their labels and the item's forms, listed once.
    expect(loaded[1]).toEqual(built.find((m) => m.senseId === "significant.notable"));
    expect(new Set(loaded[1]!.forms).size).toBe(loaded[1]!.forms.length);
  });

  it("reads nothing for no senses", async () => {
    expect(await load([])).toEqual([]);
  });
});
