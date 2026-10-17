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

/**
 * The ranking snapshot (test/search-snapshot.txt): for every golden query and example search, how
 * the engine read it and every result in order, by authored ID (sense, collocation or pattern),
 * so any change in reading, grouping or order shows up as a reviewable diff. Update it with
 * `pnpm vitest run -u` and explain every changed line in the PR.
 *
 * Full-text fallback lists are recorded as present or absent only: they come from ts_rank,
 * which the in-memory repository only approximates, and both runs share this one file.
 */
export function snapshotQueries(examples: readonly string[]) {
  return [...new Set([...GOLDEN_CASES.map((golden) => golden.query), ...examples])];
}

export async function rankingSnapshot(service: LanguageSearchService, queries: readonly string[]) {
  const blocks: string[] = [];
  for (const query of queries) {
    const r = await service.search(query);
    if (!r) {
      blocks.push(`## ${JSON.stringify(query)}\nnull`);
      continue;
    }
    const term = r.interpretation.term;
    const head = [
      r.interpretation.intent,
      r.outcome,
      term && `${term.via} → ${term.resolved}`,
      r.didYouMean && `did you mean ${r.didYouMean.join(" | ")}`,
      r.guide && `guide ${r.guide.rows.length}`,
    ].filter(Boolean);
    const lines = [`## ${JSON.stringify(query)}`, head.join(" · ")];
    if (r.outcome === "fallback") {
      const count = r.groups.reduce((total, group) => total + group.results.length, 0);
      lines.push(`fallback results: ${count > 0 ? "some" : "none"} (list not snapshotted)`);
    } else {
      for (const group of r.groups) {
        const keys = group.results.map((result) =>
          result.fit ? `${result.key} (${result.fit})` : result.key,
        );
        lines.push(`[${group.label ?? ""}] ${keys.join(", ")}`);
      }
    }
    for (const mistake of r.mistakes) lines.push(`mistake: ${mistake.wrong}`);
    blocks.push(lines.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
}
