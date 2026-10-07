/**
 * Runs the golden search suite (test/search-golden.yaml) against a search service. Shared by the
 * in-memory run (pnpm test, no database) and the PostgreSQL run (integration).
 */
import { readFileSync } from "node:fs";

import { expect } from "vitest";
import { parse } from "yaml";

import type { LanguageSearchService } from "@/language/search/service";
import type { GapFit, QueryIntent, SearchResponse } from "@/language/search/types";

export type GoldenCase = {
  query: string;
  intent: QueryIntent;
  top?: string[];
  only?: string[];
  includes?: string[];
  excludes?: string[];
  groups?: string[];
  term?: { via: "exact" | "variant" | "typo"; resolved: string };
  mistakes?: string[];
  fits?: Record<string, GapFit>;
  guide?: boolean;
  outcome?: SearchResponse["outcome"];
};

export const GOLDEN_CASES: GoldenCase[] = parse(readFileSync("test/search-golden.yaml", "utf8"));

export async function checkGolden(service: LanguageSearchService, golden: GoldenCase) {
  const response = await service.search(golden.query);
  expect(response, "a response").not.toBeNull();
  const r = response!;
  const terms = r.groups.flatMap((group) => group.results.map((result) => result.term));

  expect(r.interpretation.intent).toBe(golden.intent);
  expect(r.outcome).toBe(golden.outcome ?? "results");
  if (golden.top) expect(terms.slice(0, golden.top.length)).toEqual(golden.top);
  if (golden.only) expect(terms).toEqual(golden.only);
  for (const term of golden.includes ?? []) expect(terms).toContain(term);
  for (const term of golden.excludes ?? []) expect(terms).not.toContain(term);
  if (golden.groups) {
    const labels = r.groups.flatMap((group) => (group.label ? [group.label] : []));
    expect(labels.filter((label) => golden.groups!.includes(label))).toEqual(golden.groups);
  }
  if (golden.term) expect(r.interpretation.term).toMatchObject(golden.term);
  if (golden.mistakes) expect(r.mistakes.map((m) => m.wrong)).toEqual(golden.mistakes);
  for (const [term, fit] of Object.entries(golden.fits ?? {})) {
    const result = r.groups.flatMap((group) => group.results).find((x) => x.term === term);
    expect(result?.fit, `fit of ${term}`).toBe(fit);
  }
  if (golden.guide) expect(r.guide?.rows.length ?? 0).toBeGreaterThan(0);

  // Every result explains itself.
  for (const result of r.groups.flatMap((group) => group.results)) {
    expect(result.reason.length, `reason for ${result.term}`).toBeGreaterThan(0);
  }
  return r;
}
