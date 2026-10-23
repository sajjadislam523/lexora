import "server-only";

import { generateExercises, type PracticeMaterial } from "@/learning/exercises";
import { nextReview, reviewStatus, type NextReview, type ReviewStatus } from "@/learning/status";
import { languageHref } from "@/language/links";
import type { ItemKind } from "@/language/schema/vocabulary";
import { db } from "@/server/db/client";
import { loadPracticeMaterial } from "@/server/repositories/language/practice";
import { bankCounts, listBank, type BankCounts } from "@/server/repositories/review-cards";

/**
 * The language bank (specification §17): the learner's saved senses, a page at a time, each
 * with its review status and next review — read from `saved_senses` and `review_cards`, and
 * worded by the pure status helpers in src/learning. Nothing here schedules or changes anything.
 */
export const BANK_PAGE_SIZE = 50;

export type BankRow = {
  senseId: string;
  term: string;
  kind: ItemKind;
  senseLabel: string | null;
  definition: string;
  /** The language page, or null when the item itself is no longer published. */
  href: string | null;
  /** The first authored example, with its highlight. */
  example: { text: string; spans: { start: number; end: number }[] } | null;
  /** The first authored preposition pattern ("be responsible for + noun / -ing"). */
  pattern: string | null;
  status: ReviewStatus;
  /** Null for a retired sense: it isn't reviewed any more. */
  nextReview: NextReview | null;
  replacement: { term: string; senseLabel: string | null; href: string } | null;
};

export type BankPage = {
  counts: BankCounts;
  page: number;
  pages: number;
  rows: BankRow[];
};

/** Saved senses by section: ready to review, coming up, no longer reviewed. */
export function bankSection(status: ReviewStatus): "ready" | "coming" | "retired" {
  if (status === "due" || status === "new") return "ready";
  return status === "retired" ? "retired" : "coming";
}

/** The learner's counts by state, and how many pages the bank has. One statement. */
export async function loadBankCounts(userId: string, now: Date) {
  const counts = await bankCounts(userId, now);
  return { counts, pages: Math.max(1, Math.ceil(counts.total / BANK_PAGE_SIZE)) };
}

/**
 * One page of the bank at `now`: the counts (unless given), one page of rows, and the practice
 * material of the page's published senses (four statements) for examples, patterns and whether
 * any exercise exists.
 */
export async function loadBankPage(
  userId: string,
  page: number,
  now: Date,
  known?: Awaited<ReturnType<typeof loadBankCounts>>,
): Promise<BankPage> {
  const { counts, pages } = known ?? (await loadBankCounts(userId, now));
  const entries =
    counts.total === 0
      ? []
      : await listBank(userId, now, {
          limit: BANK_PAGE_SIZE,
          offset: (Math.min(page, pages) - 1) * BANK_PAGE_SIZE,
        });
  const live = entries.filter((entry) => !entry.retired).map((entry) => entry.senseId);
  const materials = new Map<string, PracticeMaterial>(
    (await loadPracticeMaterial(db, live)).map((material) => [material.senseId, material]),
  );

  const rows = entries.map((entry): BankRow => {
    const material = materials.get(entry.senseId);
    const example = material?.examples[0];
    const status = reviewStatus(
      {
        card: entry.card,
        retired: entry.retired,
        hasExercise: material ? generateExercises(material).length > 0 : false,
      },
      now,
    );
    const label = entry.senseLabel ?? undefined;
    return {
      senseId: entry.senseId,
      term: entry.headword,
      kind: entry.kind,
      senseLabel: entry.senseLabel,
      definition: entry.definition,
      href: entry.itemPublished ? languageHref(entry.slug, { id: entry.senseId, label }) : null,
      example: example ? { text: example.text, spans: example.highlights } : null,
      pattern: material?.patterns[0]?.pattern ?? null,
      status,
      nextReview: status === "retired" ? null : nextReview(entry.card, now),
      replacement: entry.replacement
        ? {
            term: entry.replacement.headword,
            senseLabel: entry.replacement.senseLabel,
            href: languageHref(entry.replacement.slug, {
              id: entry.replacement.senseId,
              label: entry.replacement.senseLabel ?? undefined,
            }),
          }
        : null,
    };
  });

  return { counts, page: Math.min(page, pages), pages, rows };
}
