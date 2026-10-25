/**
 * The retrieval benchmark (test/retrieval-benchmark.yaml): runs every case through a search
 * service, scores where the right language ranks, and writes a deterministic report. Shared by the
 * in-memory run (pnpm test, pnpm test:retrieval) and the PostgreSQL run, which must produce the
 * same report.
 *
 * Metrics, over the results in display order (groups flattened):
 *
 * - top-1: the first result is an expected answer.
 * - top-3 / top-5: an expected answer is among the first 3 / 5.
 * - MRR: the mean of 1 / (rank of the first expected answer), 0 when none appears.
 * - passed: see the YAML header.
 *
 * A full-text fallback ("language that mentions these words") is not an answer: it scores as no
 * results. Its order also comes from ts_rank, which the in-memory repository only approximates.
 */
import { readFileSync } from "node:fs";

import { parse } from "yaml";

import { normaliseTerm } from "@/language/normalise";
import type { LanguageSearchService } from "@/language/search/service";
import type { QueryIntent, SearchResult } from "@/language/search/types";
import type { ContentRows } from "@/server/content/build";

export const BENCHMARK_CATEGORIES = [
  "basic-lexical",
  "synonym-intent",
  "modifier-intent",
  "preposition",
  "context-gap",
  "linker",
  "functional",
  "multi-word",
  "task-aware",
] as const;
export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];

export type BenchmarkCase = {
  query: string;
  category: BenchmarkCategory;
  intent?: QueryIntent;
  expected: string[];
  acceptable?: string[];
  rejected?: string[];
};

export const BENCHMARK_CASES: BenchmarkCase[] = parse(
  readFileSync("test/retrieval-benchmark.yaml", "utf8"),
);

/**
 * Every slug and term the cases name must exist in the content: item slugs, and the terms results
 * show (headwords, item forms, collocations, "base preposition" of patterns). Returns the unknown
 * references, "query → reference".
 */
export function unknownReferences(rows: ContentRows, cases = BENCHMARK_CASES) {
  const slugs = new Set(rows.items.map((item) => item.slug ?? item.id));
  const terms = new Set(
    [
      ...rows.items.map((item) => item.headword),
      ...rows.forms.map((form) => form.form),
      ...rows.collocations.map((c) => c.phrase),
      ...rows.prepositionPatterns.map((p) => `${p.base} ${p.preposition}`),
    ].map(normaliseTerm),
  );
  return cases.flatMap((c) =>
    [...c.expected, ...(c.acceptable ?? []), ...(c.rejected ?? [])]
      .filter((ref) => !slugs.has(ref) && !terms.has(normaliseTerm(ref)))
      .map((ref) => `${c.query} → ${ref}`),
  );
}

/** A result answers a reference when its item's slug or its own term is that reference. */
function answers(result: SearchResult, ref: string) {
  return result.slug === ref || normaliseTerm(result.term) === normaliseTerm(ref);
}

export type CaseOutcome = {
  case: BenchmarkCase;
  intent?: QueryIntent;
  /** 1-based rank of the first expected answer; undefined when none appears. */
  firstExpected?: number;
  passed: boolean;
  problems: string[];
  /** The first results, as "term{slug}", for the report. */
  top: string[];
};

export async function runCase(
  service: LanguageSearchService,
  c: BenchmarkCase,
): Promise<CaseOutcome> {
  const response = await service.search(c.query);
  const results =
    response?.outcome === "results" ? response.groups.flatMap((group) => group.results) : [];
  const rankOf = (refs: readonly string[]) => {
    const index = results.findIndex((result) => refs.some((ref) => answers(result, ref)));
    return index < 0 ? undefined : index + 1;
  };
  const firstExpected = rankOf(c.expected);
  const problems: string[] = [];

  if (c.intent && response?.interpretation.intent !== c.intent) {
    problems.push(`intent ${response?.interpretation.intent ?? "none"}, want ${c.intent}`);
  }
  const first = results[0];
  if (!first) problems.push("no answer (no results, or only the full-text fallback)");
  else if (![...c.expected, ...(c.acceptable ?? [])].some((ref) => answers(first, ref))) {
    problems.push(`first result ${first.term}{${first.slug}} isn't expected or acceptable`);
  }
  if (first && (firstExpected === undefined || firstExpected > 3)) {
    problems.push(
      firstExpected === undefined ? "no expected answer" : `first expected at #${firstExpected}`,
    );
  }
  for (const ref of c.rejected ?? []) {
    const rank = rankOf([ref]);
    if (rank === undefined) continue;
    if (rank <= 3) problems.push(`rejected ${ref} at #${rank}`);
    else if (firstExpected === undefined || rank < firstExpected) {
      problems.push(`rejected ${ref} at #${rank}, above the first expected`);
    }
  }

  return {
    case: c,
    ...(response && { intent: response.interpretation.intent }),
    ...(firstExpected !== undefined && { firstExpected }),
    passed: problems.length === 0,
    problems,
    top: results.slice(0, 5).map((result) => `${result.term}{${result.slug}}`),
  };
}

export type Metrics = {
  cases: number;
  passed: number;
  top1: number;
  top3: number;
  top5: number;
  /** Sum of reciprocal ranks; divide by `cases` for MRR. */
  reciprocal: number;
};

export function metrics(outcomes: readonly CaseOutcome[]): Metrics {
  const within = (k: number) =>
    outcomes.filter((o) => o.firstExpected !== undefined && o.firstExpected <= k).length;
  return {
    cases: outcomes.length,
    passed: outcomes.filter((o) => o.passed).length,
    top1: within(1),
    top3: within(3),
    top5: within(5),
    reciprocal: outcomes.reduce((sum, o) => sum + (o.firstExpected ? 1 / o.firstExpected : 0), 0),
  };
}

export async function runBenchmark(service: LanguageSearchService, cases = BENCHMARK_CASES) {
  const outcomes: CaseOutcome[] = [];
  for (const c of cases) outcomes.push(await runCase(service, c));
  return outcomes;
}

const share = (n: number, of: number) => (of === 0 ? "—" : `${((100 * n) / of).toFixed(1)}%`);

function metricsLine(m: Metrics) {
  return [
    `passed ${m.passed}/${m.cases}`,
    `top-1 ${share(m.top1, m.cases)}`,
    `top-3 ${share(m.top3, m.cases)}`,
    `top-5 ${share(m.top5, m.cases)}`,
    `MRR ${m.cases === 0 ? "—" : (m.reciprocal / m.cases).toFixed(3)}`,
  ].join(" · ");
}

/** The report: totals, per category, then every case. Deterministic, so it can be snapshotted. */
export function benchmarkReport(outcomes: readonly CaseOutcome[]) {
  const lines = ["# Retrieval benchmark", "", metricsLine(metrics(outcomes)), "", "## Categories"];
  for (const category of BENCHMARK_CATEGORIES) {
    const own = outcomes.filter((o) => o.case.category === category);
    if (own.length > 0) lines.push(`${category.padEnd(16)} ${metricsLine(metrics(own))}`);
  }
  lines.push("", "## Cases");
  for (const o of outcomes) {
    const rank = o.firstExpected === undefined ? "—" : `#${o.firstExpected}`;
    lines.push(
      `${o.passed ? "✓" : "✗"} [${o.case.category}] ${JSON.stringify(o.case.query)} ${rank}`,
    );
    if (!o.passed) {
      lines.push(`    ${o.problems.join("; ")}`);
      lines.push(`    top: ${o.top.join(" | ") || "—"}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
