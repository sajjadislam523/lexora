import { beforeAll, describe, expect, it } from "vitest";

import type { PracticeMaterial } from "@/learning/exercises";
import { buildRows } from "@/server/content/build";
import { practiceInventory, practiceMaterialFromContent } from "@/server/content/practice";

import { loadPublishedContent } from "./published-content";

/**
 * What the published content supports as review exercises (Phase 5 Step 3), pinned.
 *
 * Maintenance: a content PR that adds, removes or edits examples, patterns, mistakes or
 * `practice` data may change these numbers. Update them in that PR and say why in its
 * description — the same rule as the ranking snapshot. `pnpm content:check --practice` lists
 * every exercise for review. A change here in a code PR means the generator changed.
 */
let materials: PracticeMaterial[];

beforeAll(async () => {
  materials = practiceMaterialFromContent(buildRows(await loadPublishedContent()));
});

describe("exercise inventory (published content)", () => {
  it("counts the exercises of each type", () => {
    const inventory = practiceInventory(materials);
    expect({
      senses: inventory.senses,
      term: inventory.term,
      preposition: inventory.preposition,
      mistake: inventory.mistake,
      total: inventory.total,
    }).toEqual({ senses: 42, term: 77, preposition: 45, mistake: 56, total: 178 });
  });

  it("gives every sense at least two exercises", () => {
    const inventory = practiceInventory(materials);
    expect(inventory.withoutExercises).toEqual([]);
    expect(inventory.sensesWithExercises).toEqual({ none: 0, one: 0, twoOrMore: 42 });
    expect(inventory.sensesWithTypes).toEqual({ 0: 0, 1: 3, 2: 25, 3: 14 });
  });

  it("skips exactly the examples the authored content can't make a safe blank from", () => {
    expect(practiceInventory(materials).unusedExamples).toEqual({
      // The form is split by another word, or isn't the item's form at all ("a sharp rise").
      term: [
        "pose-a-threat.danger:ex1",
        "raise-awareness.inform:ex2",
        "rise-sharply.increase:ex2",
        "take-measures.act:ex1",
      ],
      // The highlight goes past the preposition ("contribute to keeping", "important to me").
      preposition: ["contribute-to.help-cause:ex2", "important.main:ex2"],
    });
  });

  it("has the accept lists authored in the Step 3b content review", () => {
    const examples = materials.flatMap((m) => m.examples);
    expect({
      withAccept: examples.filter((e) => e.accept.length).length,
      accepted: examples.reduce((n, e) => n + e.accept.length, 0),
      withAcceptPreposition: examples.filter((e) => e.acceptPreposition.length).length,
      acceptedPrepositions: examples.reduce((n, e) => n + e.acceptPreposition.length, 0),
      withExclude: examples.filter((e) => e.exclude.length).length,
    }).toEqual({
      withAccept: 26,
      accepted: 28,
      withAcceptPreposition: 5,
      acceptedPrepositions: 5,
      withExclude: 0,
    });
  });

  it("accepts every authored answer, and none repeats a form, the expected answer or a mistake", async () => {
    const { generateExercises } = await import("@/learning/exercises");
    const { evaluateAnswer, normaliseAnswer } = await import("@/learning/answers");
    for (const material of materials) {
      for (const { prompt, key } of generateExercises(material)) {
        if (key.kind !== "typed") continue;
        for (const accepted of key.accepted) {
          expect(evaluateAnswer(key, accepted), `${prompt.id}: ${accepted}`).toMatchObject({
            outcome: "correct",
            match: "accepted",
          });
          expect(key.forms, prompt.id).not.toContain(accepted);
          expect(accepted, prompt.id).not.toBe(normaliseAnswer(key.expected));
          expect(
            key.mistakes.map((m) => m.answer),
            prompt.id,
          ).not.toContain(accepted);
        }
      }
    }
  });

  it("blanks the authored sentence exactly, and never shows the answer elsewhere", async () => {
    const { generateExercises } = await import("@/learning/exercises");
    const { normaliseAnswer } = await import("@/learning/answers");
    const words = (text: string) =>
      ` ${(text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).map(normaliseAnswer).join(" ")} `;
    for (const material of materials) {
      for (const { prompt, key, source } of generateExercises(material)) {
        if (key.kind !== "typed") continue;
        const sentence = prompt.sentence!;
        expect(
          sentence.filter((part) => typeof part !== "string"),
          prompt.id,
        ).toHaveLength(1);
        // The answer put back in the blank gives the authored sentence, character for character.
        const authored = material.examples.find((e) => e.id === source)!.text;
        expect(
          sentence.map((part) => (typeof part === "string" ? part : key.expected)).join(""),
        ).toBe(authored);
        // A completion blank's answer appears nowhere else in what the learner sees. (A preposition
        // may: "hours on screens … effect ___ sleep" — a common word elsewhere isn't the pattern's.)
        if (prompt.type !== "term") continue;
        const shown = sentence
          .filter((part): part is string => typeof part === "string")
          .join(" ___ ");
        expect(words(shown), prompt.id).not.toContain(` ${normaliseAnswer(key.expected)} `);
      }
    }
  });
});
