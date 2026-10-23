import "server-only";

import { generateExercises, type PracticeMaterial } from "@/learning/exercises";
import type { PracticeBlank } from "@/language/schema/vocabulary";

import type { ContentRows } from "./build";

/**
 * Practice material (src/learning/exercises.ts) from language rows, shared by the database
 * repository (what review sessions read) and the built content rows (the inventory, the
 * readiness report and `content:check`), so both always assemble the same material. Only
 * published senses of published items; children in authored order; forms sorted by code point,
 * so the result never depends on storage order.
 */
export type PracticeRows = {
  items: { id: string; kind: string; headword: string; status?: string | null }[];
  /**
   * Published senses per item, when `senses` holds only some of them (the database read): an
   * item with several gets its sense labels shown. Counted from `senses` when absent.
   */
  liveSensesPerItem?: ReadonlyMap<string, number>;
  senses: {
    id: string;
    itemId: string;
    label?: string | null;
    definition: string;
    position: number;
    status?: string | null;
  }[];
  forms: { itemId: string; form: string }[];
  examples: {
    id: string;
    senseId: string;
    text: string;
    highlights: { start: number; end: number }[];
    prepositionPatternId?: string | null;
    position: number;
    practiceAccept?: string[] | null;
    practiceAcceptPreposition?: string[] | null;
    practiceExclude?: PracticeBlank[] | null;
  }[];
  patterns: {
    id: string;
    senseId: string;
    base: string;
    preposition: string;
    pattern: string;
    note?: string | null;
    mistakeId?: string | null;
    position: number;
  }[];
  mistakes: {
    id: string;
    senseId: string;
    wrong: string;
    right: string;
    type: string;
    explanation: string;
    position: number;
  }[];
};

const published = (status?: string | null) => (status ?? "published") === "published";
const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The material for these senses (or every published sense), in the order asked for. */
export function assemblePracticeMaterial(
  rows: PracticeRows,
  senseIds?: readonly string[],
): PracticeMaterial[] {
  const items = new Map(rows.items.filter((i) => published(i.status)).map((i) => [i.id, i]));
  const live = rows.senses.filter((s) => published(s.status) && items.has(s.itemId));
  const sensesPerItem = new Map<string, number>(rows.liveSensesPerItem);
  if (!rows.liveSensesPerItem) {
    for (const sense of live) {
      sensesPerItem.set(sense.itemId, (sensesPerItem.get(sense.itemId) ?? 0) + 1);
    }
  }

  const wanted = senseIds
    ? senseIds.flatMap((id) => live.find((s) => s.id === id) ?? [])
    : [...live].sort((a, b) => byCodePoint(a.itemId, b.itemId) || byPosition(a, b));

  return wanted.map((sense) => {
    const item = items.get(sense.itemId)!;
    return {
      senseId: sense.id,
      itemKind: item.kind,
      term: item.headword,
      ...((sensesPerItem.get(item.id) ?? 0) > 1 && sense.label ? { senseLabel: sense.label } : {}),
      definition: sense.definition,
      forms: rows.forms
        .filter((f) => f.itemId === item.id)
        .map((f) => f.form)
        .sort(byCodePoint),
      examples: rows.examples
        .filter((e) => e.senseId === sense.id)
        .sort(byPosition)
        .map((e) => ({
          id: e.id,
          text: e.text,
          highlights: [...e.highlights].sort((a, b) => a.start - b.start),
          patternId: e.prepositionPatternId ?? null,
          accept: e.practiceAccept ?? [],
          acceptPreposition: e.practiceAcceptPreposition ?? [],
          exclude: e.practiceExclude ?? [],
        })),
      patterns: rows.patterns
        .filter((p) => p.senseId === sense.id)
        .sort(byPosition)
        .map((p) => ({
          id: p.id,
          base: p.base,
          preposition: p.preposition,
          pattern: p.pattern,
          note: p.note ?? null,
          mistakeId: p.mistakeId ?? null,
        })),
      mistakes: rows.mistakes
        .filter((m) => m.senseId === sense.id)
        .sort(byPosition)
        .map((m) => ({
          id: m.id,
          wrong: m.wrong,
          right: m.right,
          type: m.type,
          explanation: m.explanation,
        })),
    };
  });
}

/** The practice material of built content (before import): every published sense. */
export function practiceMaterialFromContent(rows: ContentRows): PracticeMaterial[] {
  return assemblePracticeMaterial({
    items: rows.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      headword: i.headword,
      status: i.status,
    })),
    senses: rows.senses.map((s) => ({
      id: s.id,
      itemId: s.itemId,
      label: s.label,
      definition: s.definition,
      position: s.position,
      status: s.status,
    })),
    forms: rows.forms.map((f) => ({ itemId: f.itemId, form: f.form })),
    examples: rows.examples.map((e) => ({
      id: e.id,
      senseId: e.senseId,
      text: e.text,
      highlights: e.highlights,
      prepositionPatternId: e.prepositionPatternId,
      position: e.position,
      practiceAccept: e.practiceAccept,
      practiceAcceptPreposition: e.practiceAcceptPreposition,
      practiceExclude: e.practiceExclude,
    })),
    patterns: rows.prepositionPatterns.map((p) => ({
      id: p.id,
      senseId: p.senseId,
      base: p.base,
      preposition: p.preposition,
      pattern: p.pattern,
      note: p.note,
      mistakeId: p.mistakeId,
      position: p.position,
    })),
    mistakes: rows.mistakes.map((m) => ({
      id: m.id,
      senseId: m.senseId,
      wrong: m.wrong,
      right: m.right,
      type: m.type,
      explanation: m.explanation,
      position: m.position,
    })),
  });
}

export type PracticeInventory = {
  senses: number;
  term: number;
  preposition: number;
  mistake: number;
  total: number;
  /** Senses by how many exercises they have: none, one, two or more. */
  sensesWithExercises: { none: number; one: number; twoOrMore: number };
  /** Senses by how many exercise types they have. */
  sensesWithTypes: Record<0 | 1 | 2 | 3, number>;
  /** Senses whose content supports no exercise (they read as "no exercise yet"). */
  withoutExercises: string[];
  /** Examples that could carry a blank but make none, by blank (for the content review). */
  unusedExamples: { term: string[]; preposition: string[] };
};

/** What the material supports, for the readiness report and the inventory test. */
export function practiceInventory(materials: readonly PracticeMaterial[]): PracticeInventory {
  const inventory: PracticeInventory = {
    senses: materials.length,
    term: 0,
    preposition: 0,
    mistake: 0,
    total: 0,
    sensesWithExercises: { none: 0, one: 0, twoOrMore: 0 },
    sensesWithTypes: { 0: 0, 1: 0, 2: 0, 3: 0 },
    withoutExercises: [],
    unusedExamples: { term: [], preposition: [] },
  };
  for (const material of materials) {
    const exercises = generateExercises(material);
    const ids = new Set(exercises.map((e) => e.prompt.id));
    for (const exercise of exercises) inventory[exercise.prompt.type]++;
    inventory.total += exercises.length;
    const types = new Set(exercises.map((e) => e.prompt.type)).size as 0 | 1 | 2 | 3;
    inventory.sensesWithTypes[types]++;
    if (exercises.length === 0) {
      inventory.sensesWithExercises.none++;
      inventory.withoutExercises.push(material.senseId);
    } else if (exercises.length === 1) inventory.sensesWithExercises.one++;
    else inventory.sensesWithExercises.twoOrMore++;
    for (const example of material.examples) {
      if (material.itemKind !== "preposition_pattern" && !ids.has(`term:${example.id}`)) {
        inventory.unusedExamples.term.push(example.id);
      }
      if (example.patternId && !ids.has(`preposition:${example.id}`)) {
        inventory.unusedExamples.preposition.push(example.id);
      }
    }
  }
  return inventory;
}
