import "server-only";

import { createHash } from "node:crypto";

import { normaliseTerm } from "@/language/normalise";
import type { FramePartFile, ItemFile, SenseFile } from "@/language/schema/content";
import { INVERSE_RELATION, type RelationType, type SlotType } from "@/language/schema/vocabulary";
import type * as schema from "@/server/db/schema";
import type { HighlightSpan, StoredFramePart } from "@/server/db/schema/language";

import type { ValidatedContent } from "./validate";

/**
 * Turns validated content into database rows. Pure and deterministic: the same content always
 * produces the same rows in the same order, which is what makes the import repeatable.
 */

/** Bump when the row-building rules change, so the next import runs even if content didn't. */
export const IMPORTER_VERSION = 1;

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

export type ContentRows = {
  sources: Insert<typeof schema.contentSources>[];
  items: Insert<typeof schema.languageItems>[];
  slugHistory: Insert<typeof schema.itemSlugHistory>[];
  forms: Insert<typeof schema.itemForms>[];
  senses: Insert<typeof schema.senses>[];
  linkers: Insert<typeof schema.linkerDetails>[];
  mistakes: Insert<typeof schema.mistakes>[];
  collocations: Insert<typeof schema.collocations>[];
  prepositionPatterns: Insert<typeof schema.prepositionPatterns>[];
  examples: Insert<typeof schema.examples>[];
  frames: Insert<typeof schema.frames>[];
  relations: Insert<typeof schema.senseRelations>[];
  intents: Insert<typeof schema.intents>[];
  intentTriggers: Insert<typeof schema.intentTriggers>[];
  intentEntries: Insert<typeof schema.intentEntries>[];
};

export function senseId(item: ItemFile, sense: SenseFile) {
  return `${item.id}.${sense.key}`;
}

export function childId(sense: string, local: string) {
  return `${sense}:${local}`;
}

export function buildRows(content: ValidatedContent): ContentRows {
  const rows: ContentRows = {
    sources: content.sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.kind,
      licence: source.licence,
      licenceUrl: source.licence_url ?? null,
      attribution: source.attribution ?? null,
      url: source.url ?? null,
      permittedUses: source.permitted_uses,
      verifiedOn: source.verified_on ?? null,
    })),
    items: [],
    slugHistory: [],
    forms: [],
    senses: [],
    linkers: [],
    mistakes: [],
    collocations: [],
    prepositionPatterns: [],
    examples: [],
    frames: [],
    relations: [],
    intents: [],
    intentTriggers: [],
    intentEntries: [],
  };

  for (const item of content.items) {
    rows.items.push({
      id: item.id,
      slug: item.slug ?? item.id,
      kind: item.kind,
      headword: item.headword,
      normalized: normaliseTerm(item.headword),
      status: item.status,
      replacedBy: item.replaced_by ?? null,
      regionalNote: item.regional_note ?? null,
      sourceId: item.source,
      informedBy: item.informed_by ?? [],
      authoredBy: item.review.author,
      reviewedBy: item.review.reviewer ?? null,
      reviewedOn: item.review.on ?? null,
      reviewLevel: item.review.level ?? null,
    });
    for (const slug of item.previous_slugs ?? []) rows.slugHistory.push({ slug, itemId: item.id });

    const defaultForm =
      item.forms.find((form) => form.default) ?? item.forms.find((form) => form.type === "lemma");
    for (const form of item.forms) {
      rows.forms.push({
        itemId: item.id,
        form: form.form,
        normalized: normaliseTerm(form.form),
        formType: form.type,
        region: form.region ?? null,
        isDefault: form === defaultForm,
      });
    }

    item.senses.forEach((sense, position) => buildSense(rows, item, sense, position));
  }

  for (const intent of content.intents) {
    rows.intents.push({
      id: intent.id,
      label: intent.label,
      description: intent.description ?? null,
      function: intent.function ?? null,
    });
    for (const trigger of intent.triggers) {
      rows.intentTriggers.push({
        intentId: intent.id,
        phrase: trigger,
        normalized: normaliseTerm(trigger),
      });
    }
    let position = 0;
    for (const group of intent.groups) {
      for (const entry of group.entries) {
        rows.intentEntries.push({
          intentId: intent.id,
          senseId: entry.sense,
          groupLabel: group.label,
          position: position++,
          fitNote: entry.fit,
        });
      }
    }
  }

  return rows;
}

function buildSense(rows: ContentRows, item: ItemFile, sense: SenseFile, position: number) {
  const id = senseId(item, sense);
  const child = (local: string) => childId(id, local);

  rows.senses.push({
    id,
    itemId: item.id,
    position,
    status: sense.retired ? "retired" : "published",
    replacedBy: sense.replaced_by ?? null,
    label: sense.label ?? null,
    definition: sense.definition,
    partOfSpeech: sense.pos,
    cefr: sense.cefr,
    registers: sense.registers,
    skills: sense.skills,
    ieltsRelevance: sense.ielts.relevance,
    ieltsTasks: sense.ielts.tasks,
    strength: sense.strength ?? null,
    functions: sense.functions ?? [],
    bestWhen: sense.best_when,
    avoidWhen: sense.avoid_when ?? null,
    skillNote: sense.skill_note ?? null,
    standaloneReason: sense.standalone ?? null,
  });

  if (sense.linker) {
    rows.linkers.push({
      senseId: id,
      connects: sense.linker.connects,
      positions: sense.linker.positions,
      punctuation: sense.linker.punctuation,
    });
  }

  sense.mistakes.forEach((mistake, index) =>
    rows.mistakes.push({
      id: child(mistake.id),
      senseId: id,
      wrong: mistake.wrong,
      wrongNormalized: normaliseTerm(mistake.wrong),
      right: mistake.right,
      explanation: mistake.explanation,
      type: mistake.type,
      position: index,
    }),
  );

  sense.collocations.forEach((collocation, index) =>
    rows.collocations.push({
      id: child(collocation.id),
      senseId: id,
      phrase: collocation.phrase,
      normalized: normaliseTerm(collocation.phrase),
      pattern: collocation.pattern ?? null,
      note: collocation.note ?? null,
      registers: collocation.registers ?? null,
      skills: collocation.skills ?? null,
      itemId: collocation.item ?? null,
      position: index,
    }),
  );

  sense.preposition_patterns.forEach((pattern, index) =>
    rows.prepositionPatterns.push({
      id: child(pattern.id),
      senseId: id,
      base: pattern.base,
      baseNormalized: normaliseTerm(pattern.base),
      preposition: pattern.preposition,
      pattern: pattern.pattern,
      complement: pattern.complement,
      note: pattern.note ?? null,
      mistakeId: pattern.mistake ? child(pattern.mistake) : null,
      position: index,
    }),
  );

  sense.examples.forEach((example, index) =>
    rows.examples.push({
      id: child(example.id),
      senseId: id,
      text: example.text,
      highlights: highlightSpans(
        example.text,
        Array.isArray(example.highlight) ? example.highlight : [example.highlight],
      ),
      skill: example.skill,
      ieltsTask: example.task ?? null,
      collocationId: example.collocation ? child(example.collocation) : null,
      prepositionPatternId: example.pattern ? child(example.pattern) : null,
      position: index,
      sourceId: example.source ?? item.source,
    }),
  );

  sense.frames.forEach((frame, index) =>
    rows.frames.push({
      id: child(frame.id),
      senseId: id,
      parts: frame.parts.map(storedPart),
      display: frameDisplay(frame.parts),
      headNormalized: frameHead(frame.parts),
      position: index,
    }),
  );

  for (const relation of sense.relations) {
    const shared = {
      note: relation.note ?? null,
      contextNote: relation.context ?? null,
      weight: relation.weight,
      sourceId: item.source,
    };
    rows.relations.push({
      ...shared,
      fromSenseId: id,
      toSenseId: relation.to,
      type: relation.type,
      isInverse: false,
    });
    rows.relations.push({
      ...shared,
      fromSenseId: relation.to,
      toSenseId: id,
      type: INVERSE_RELATION[relation.type] as RelationType,
      isInverse: true,
    });
  }
}

/** Character ranges of each highlight, found case-insensitively; validation guarantees a match. */
export function highlightSpans(text: string, highlights: string[]): HighlightSpan[] {
  const lower = text.toLowerCase();
  return highlights
    .map((highlight) => {
      const start = lower.indexOf(highlight.toLowerCase());
      return { start, end: start + highlight.length };
    })
    .filter((span) => span.start >= 0)
    .sort((a, b) => a.start - b.start);
}

function storedPart(part: FramePartFile): StoredFramePart {
  return "text" in part
    ? { text: part.text, ...(part.head && { head: true }), ...(part.also && { also: part.also }) }
    : {
        slot: part.slot,
        ...(part.hint && { hint: part.hint }),
        ...(part.fillers && { fillers: part.fillers }),
      };
}

const SLOT_LABELS: Record<SlotType, string> = {
  object: "something",
  noun: "+ noun",
  ing: "+ -ing",
  clause: "+ clause",
  adjective: "+ adjective",
  person: "+ person",
};

/** `invest something in / into + noun`, `There is growing concern that + clause`. */
export function frameDisplay(parts: FramePartFile[]) {
  return parts
    .map((part) =>
      "text" in part ? [part.text, ...(part.also ?? [])].join(" / ") : SLOT_LABELS[part.slot],
    )
    .join(" ");
}

/** The word a frame is found by: its head part, or else its first literal part. */
export function frameHead(parts: FramePartFile[]) {
  const literal = parts.filter((part) => "text" in part);
  const head = literal.find((part) => part.head) ?? literal[0];
  return head ? normaliseTerm(head.text) : "";
}

/** A fingerprint of the content and the importer version: equal checksums mean nothing to do. */
export function contentChecksum(content: ValidatedContent) {
  return createHash("sha256")
    .update(JSON.stringify({ version: IMPORTER_VERSION, content }))
    .digest("hex");
}
