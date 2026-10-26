import "server-only";

import { generateExercises, type PracticeMaterial } from "@/learning/exercises";
import type { LearningReason } from "@/learning/state";
import {
  statusOf,
  type LearningStage,
  type NextReview,
  type ReviewStatus,
} from "@/learning/status";
import { languageHref } from "@/language/links";
import type { ItemKind } from "@/language/schema/vocabulary";
import { db } from "@/server/db/client";
import { loadPracticeMaterial } from "@/server/repositories/language/practice";
import { describeEvidence, type MistakeEvidence } from "@/server/learning/evidence";
import { loadLearningStates } from "@/server/learning/state";
import {
  bankCounts,
  listBank,
  recurringMistakes,
  type BankCounts,
  type BankFilter,
} from "@/server/repositories/review-cards";

export { BANK_FILTERS, type BankFilter } from "@/server/repositories/review-cards";

/**
 * The language bank (specification §17): the learner's saved senses, a page at a time, in the
 * bank's order, optionally filtered by learning stage or due (Phase 7.2). What each row says about
 * learning — its stage, due, next review, reason and status — is its learning state from
 * `loadLearningStates` (Phase 7.1), read for the page's senses in one batch; the bank derives
 * none of it itself. Nothing here schedules or changes anything.
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
  /** New, learning or known, whether or not it's due (the learning state's stage). */
  stage: LearningStage;
  /** It can be reviewed now (never for a retired sense). */
  due: boolean;
  /** Why it's in its stage, as observed facts. */
  reason: LearningReason;
  /** Null for a retired sense: it isn't reviewed any more. */
  nextReview: NextReview | null;
  replacement: { term: string; senseLabel: string | null; href: string } | null;
  /** Wrong answers on this card, when there have been at least two ("Missed 2 times"). */
  missed: number | null;
  /** Recurring mistakes on this sense (§16), most recent first. */
  mistakes: MistakeEvidence[];
};

export type BankPage = {
  counts: BankCounts;
  filter: BankFilter;
  page: number;
  pages: number;
  rows: BankRow[];
};

/** The bank's one URL for a filter and page: `?show=` first, then `?page=` from 2. */
export function bankPath(filter: BankFilter, page = 1) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("show", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/bank?${query}` : "/bank";
}

/** Saved senses by section: ready to review, coming up, no longer reviewed. */
export function bankSection(status: ReviewStatus): "ready" | "coming" | "retired" {
  if (status === "due" || status === "new") return "ready";
  return status === "retired" ? "retired" : "coming";
}

/** The learner's counts by state, and how many pages the filtered bank has. One statement. */
export async function loadBankCounts(userId: string, now: Date, filter: BankFilter = "all") {
  const counts = await bankCounts(userId, now);
  return { counts, pages: Math.max(1, Math.ceil(counts.filters[filter] / BANK_PAGE_SIZE)) };
}

/** A card with this many wrong answers needs more review: the bank says "Missed n times" (§16). */
const MISSED_FROM = 2;

/**
 * One page of the (filtered) bank at `now`: the counts (unless given), one page of rows, then
 * for that page's senses only, in parallel: their learning states (one statement), the practice
 * material of the published ones (four) for examples, patterns and whether any exercise exists,
 * and their recurring mistakes (one). Never a read per row, and never the whole bank.
 */
export async function loadBankPage(
  userId: string,
  page: number,
  now: Date,
  known?: Awaited<ReturnType<typeof loadBankCounts>>,
  filter: BankFilter = "all",
): Promise<BankPage> {
  const { counts, pages } = known ?? (await loadBankCounts(userId, now, filter));
  const entries =
    counts.filters[filter] === 0
      ? []
      : await listBank(userId, now, {
          limit: BANK_PAGE_SIZE,
          offset: (Math.min(page, pages) - 1) * BANK_PAGE_SIZE,
          filter,
        });
  const live = entries.filter((entry) => !entry.retired).map((entry) => entry.senseId);
  const [states, materialRows, recurring] = await Promise.all([
    entries.length > 0
      ? loadLearningStates(
          userId,
          entries.map((entry) => entry.senseId),
          now,
        )
      : new Map(),
    loadPracticeMaterial(db, live),
    recurringMistakes(db, userId, live, now),
  ]);
  const materials = new Map<string, PracticeMaterial>(materialRows.map((m) => [m.senseId, m]));

  // A save removed between the two reads has no learning state any more: leave it out.
  const rows = entries.flatMap((entry): BankRow[] => {
    const state = states.get(entry.senseId);
    if (!state) return [];
    const material = materials.get(entry.senseId);
    const example = material?.examples[0];
    const status = statusOf({
      retired: state.retired,
      hasExercise: material ? generateExercises(material).length > 0 : false,
      stage: state.stage,
      due: state.due,
    });
    const label = entry.senseLabel ?? undefined;
    const row: BankRow = {
      senseId: entry.senseId,
      term: entry.headword,
      kind: entry.kind,
      senseLabel: entry.senseLabel,
      definition: entry.definition,
      href: entry.itemPublished ? languageHref(entry.slug, { id: entry.senseId, label }) : null,
      example: example ? { text: example.text, spans: example.highlights } : null,
      pattern: material?.patterns[0]?.pattern ?? null,
      status,
      stage: state.stage,
      due: state.due,
      reason: state.reason,
      nextReview: state.nextReview,
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
      missed: entry.card.lapses >= MISSED_FROM ? entry.card.lapses : null,
      mistakes: recurring
        .filter((r) => r.senseId === entry.senseId)
        .flatMap((r) => describeEvidence(r, materials.get(entry.senseId)) ?? []),
    };
    return [row];
  });

  return { counts, filter, page: Math.min(page, pages), pages, rows };
}
