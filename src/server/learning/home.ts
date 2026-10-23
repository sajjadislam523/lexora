import "server-only";

import { generateExercises } from "@/learning/exercises";
import { nextReview, reviewStatus, type NextReview, type ReviewStatus } from "@/learning/status";
import { languageHref } from "@/language/links";
import type { ItemKind } from "@/language/schema/vocabulary";
import { db } from "@/server/db/client";
import { describeEvidence, type MistakeEvidence } from "@/server/learning/evidence";
import { loadPracticeMaterial, loadSenseNotes } from "@/server/repositories/language/practice";
import {
  bankCounts,
  recentlySaved,
  recurringMistakes,
  reviewQueue,
  type BankCounts,
} from "@/server/repositories/review-cards";

/**
 * Home (specification §18, D15): only numbers that are persisted or derived from persisted data,
 * each one changing what the learner does next. No sample data, percentages, streaks or
 * "reviewed today". Nothing here schedules or writes.
 */
const RECENT = 4;
const MISTAKES = 3;

export type HomeRecent = {
  senseId: string;
  term: string;
  kind: ItemKind;
  senseLabel: string | null;
  /** The sense's authored best-when: a usage line, not a definition. */
  context: string;
  href: string;
  status: ReviewStatus;
};

export type HomeMistake = MistakeEvidence & { term: string; href: string };

export type Home =
  | { kind: "empty" }
  | {
      kind: "learner";
      counts: BankCounts;
      /** Due now: reviewed cards that are due, and new saves (as the bank counts them). */
      ready: number;
      /** When nothing is ready: the soonest review, if any is scheduled. */
      nextReview: NextReview | null;
      recent: HomeRecent[];
      /** Up to three recurring mistakes (§16), most recent first. */
      mistakes: HomeMistake[];
    };

/**
 * The learner's Home at `now`: counts (one statement), the next review, the latest saves and the
 * recurring mistakes (one each, in parallel), then the practice material and slugs of the
 * senses those name (five, batched).
 */
export async function loadHome(userId: string, now: Date): Promise<Home> {
  const [counts, upcoming, recent, recurring] = await Promise.all([
    bankCounts(userId, now),
    reviewQueue(userId, now, { when: "upcoming", limit: 1 }),
    recentlySaved(userId, RECENT),
    recurringMistakes(db, userId, null, now),
  ]);
  if (counts.total === 0) return { kind: "empty" };

  const mistakeSenses = recurring.map((r) => r.senseId);
  const [materials, notes] = await Promise.all([
    loadPracticeMaterial(db, [...recent.map((entry) => entry.senseId), ...mistakeSenses]),
    loadSenseNotes(db, mistakeSenses),
  ]);
  const material = new Map(materials.map((m) => [m.senseId, m]));
  const note = new Map(notes.map((n) => [n.senseId, n]));

  const ready = counts.due + counts.new;
  return {
    kind: "learner",
    counts,
    ready,
    nextReview: ready === 0 && upcoming[0] ? nextReview(upcoming[0].card, now) : null,
    recent: recent.map((entry) => {
      const senseMaterial = material.get(entry.senseId);
      return {
        senseId: entry.senseId,
        term: entry.headword,
        kind: entry.kind,
        senseLabel: entry.senseLabel,
        context: entry.bestWhen,
        href: languageHref(entry.slug, {
          id: entry.senseId,
          label: entry.senseLabel ?? undefined,
        }),
        status: reviewStatus(
          {
            card: entry.card,
            retired: false,
            hasExercise: senseMaterial ? generateExercises(senseMaterial).length > 0 : false,
          },
          now,
        ),
      };
    }),
    mistakes: recurring
      .flatMap((r) => {
        const evidence = describeEvidence(r, material.get(r.senseId));
        const sense = note.get(r.senseId);
        const term = material.get(r.senseId)?.term;
        if (!evidence || !sense || !term) return [];
        const href = languageHref(sense.slug, { id: r.senseId, label: sense.label ?? undefined });
        return [{ ...evidence, term, href }];
      })
      .slice(0, MISTAKES),
  };
}
