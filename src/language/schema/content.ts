/**
 * The authored content format: the shape of each YAML file in `content/` (see content/README.md).
 * Zod checks one file at a time. Rules that span files (references, uniqueness, the quality
 * checklist) live in the validator, src/server/content/validate.ts.
 *
 * Objects are strict, so a misspelt field is an error instead of being silently ignored.
 */
import { z } from "zod";

import {
  AUTHORED_RELATION_TYPES,
  CEFR_LEVELS,
  COMPLEMENTS,
  CONTENT_STATUSES,
  DISCOURSE_FUNCTIONS,
  FORM_TYPES,
  IELTS_RELEVANCE,
  IELTS_TASKS,
  ITEM_KINDS,
  LINKER_CONNECTS,
  LINKER_POSITIONS,
  MISTAKE_TYPES,
  PARTS_OF_SPEECH,
  REGIONS,
  REGISTERS,
  REVIEW_LEVELS,
  SKILLS,
  SLOT_TYPES,
  SOURCE_KINDS,
  SOURCE_USES,
} from "./vocabulary";

/** Item, intent and source IDs, and local keys: lower-case kebab-case (`responsible-for`, `ex1`). */
export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Sense IDs: `<item id>.<sense key>` (`significant.notable`). */
export const SENSE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

const key = z.string().regex(KEY_PATTERN, "must be lower-case kebab-case, e.g. responsible-for");
const senseRef = z
  .string()
  .regex(SENSE_ID_PATTERN, "must be a sense ID: <item>.<sense>, e.g. significant.notable");
const text = z.string().trim().min(1, "must not be empty");
const isoDate = z.iso.date("must be a date: YYYY-MM-DD");
const nonEmptyList = <T extends z.ZodType>(schema: T) => z.array(schema).min(1);
const uniqueList = <T extends z.ZodType<string>>(schema: T) =>
  z
    .array(schema)
    .min(1)
    .refine((list) => new Set(list).size === list.length, "must not repeat a value");

// ── Sources ────────────────────────────────────────────────────────────────────────────────

export const sourceSchema = z.strictObject({
  id: key,
  name: text,
  kind: z.enum(SOURCE_KINDS),
  /** SPDX identifier, or `LicenseRef-…` for anything else. */
  licence: text,
  licence_url: z.url().optional(),
  attribution: text.optional(),
  url: z.url().optional(),
  permitted_uses: uniqueList(z.enum(SOURCE_USES)),
  /** When the licence was last checked. Required for every source except Lexora's own. */
  verified_on: isoDate.optional(),
});
export type SourceFile = z.infer<typeof sourceSchema>;

export const sourcesFileSchema = z.array(sourceSchema).min(1);

// ── Items ──────────────────────────────────────────────────────────────────────────────────

const formSchema = z.strictObject({
  form: text,
  type: z.enum(FORM_TYPES),
  region: z.enum(REGIONS).optional(),
  /** The form shown by default. One per item; defaults to the first lemma. */
  default: z.boolean().optional(),
});

const exampleSchema = z.strictObject({
  id: key,
  text,
  /** The words to highlight. Each must occur in the text; spans are computed at import. */
  highlight: z.union([text, nonEmptyList(text)]),
  skill: z.enum(SKILLS),
  task: z.enum(IELTS_TASKS).optional(),
  /** Local ID of a collocation or preposition pattern of the same sense that this example shows. */
  collocation: key.optional(),
  pattern: key.optional(),
  /** Defaults to the item's source. */
  source: key.optional(),
});

const collocationSchema = z.strictObject({
  id: key,
  phrase: text,
  /** Display pattern, e.g. `a significant increase in + noun`. */
  pattern: text.optional(),
  note: text.optional(),
  /** Default to the sense's registers and skills. */
  registers: uniqueList(z.enum(REGISTERS)).optional(),
  skills: uniqueList(z.enum(SKILLS)).optional(),
  /** The full collocation item, when Lexora has one (`play-a-crucial-role`). */
  item: key.optional(),
});

const prepositionPatternSchema = z.strictObject({
  id: key,
  /** The word the preposition follows (`responsible`). Searched by "preposition after …". */
  base: text,
  preposition: text,
  /** Display pattern, e.g. `be responsible for + noun / -ing`. */
  pattern: text,
  complement: z.enum(COMPLEMENTS),
  note: text.optional(),
  /** Local ID of the mistake this pattern prevents. */
  mistake: key.optional(),
});

const frameTextPart = z.strictObject({
  text,
  /** The verb or word this frame is found by (context-gap search). */
  head: z.boolean().optional(),
  /** Other words accepted in this position (`in`, also `into`). */
  also: nonEmptyList(text).optional(),
});
const frameSlotPart = z.strictObject({
  slot: z.enum(SLOT_TYPES),
  hint: text.optional(),
  /** Words that typically fill the slot (`money`, `funds`). Used for context-gap fit. */
  fillers: nonEmptyList(text).optional(),
});

const frameSchema = z.strictObject({
  id: key,
  parts: nonEmptyList(z.union([frameTextPart, frameSlotPart])),
});

const mistakeSchema = z.strictObject({
  id: key,
  wrong: text,
  right: text,
  type: z.enum(MISTAKE_TYPES),
  explanation: text,
});

const relationSchema = z.strictObject({
  type: z.enum(AUTHORED_RELATION_TYPES),
  to: senseRef,
  /** Editorial weight, 3 (strongest recommendation) to 1. */
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  /** How the target differs: shown in results and fit guides. */
  note: text.optional(),
  /** When the relation holds only in some contexts ("in Task 1 descriptions"). */
  context: text.optional(),
});

const linkerSchema = z.strictObject({
  connects: z.enum(LINKER_CONNECTS),
  positions: uniqueList(z.enum(LINKER_POSITIONS)),
  punctuation: text,
});

const senseSchema = z.strictObject({
  key,
  /** Short disambiguator shown when an item has several senses ("having a real effect"). */
  label: text.optional(),
  /** Retired senses stay in the file and the database so saved references keep working. */
  retired: z.boolean().optional(),
  replaced_by: senseRef.optional(),
  pos: z.enum(PARTS_OF_SPEECH),
  definition: text,
  cefr: z.enum(CEFR_LEVELS),
  registers: uniqueList(z.enum(REGISTERS)),
  skills: uniqueList(z.enum(SKILLS)),
  ielts: z.strictObject({
    relevance: z.enum(IELTS_RELEVANCE),
    tasks: uniqueList(z.enum(IELTS_TASKS)),
  }),
  /** 1 (plain) to 3 (strongest), for words with stronger and weaker alternatives. */
  strength: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  functions: uniqueList(z.enum(DISCOURSE_FUNCTIONS)).optional(),
  best_when: text,
  avoid_when: text.optional(),
  /** How the writing and speaking use differ. */
  skill_note: text.optional(),
  /** Why this sense has no relations (exempts it from the "at least one relation" rule). */
  standalone: text.optional(),
  linker: linkerSchema.optional(),
  examples: z.array(exampleSchema).default([]),
  collocations: z.array(collocationSchema).default([]),
  preposition_patterns: z.array(prepositionPatternSchema).default([]),
  frames: z.array(frameSchema).default([]),
  mistakes: z.array(mistakeSchema).default([]),
  relations: z.array(relationSchema).default([]),
});

export const itemSchema = z.strictObject({
  id: key,
  /** Defaults to the ID. May change; the old slug must then be listed in `previous_slugs`. */
  slug: key.optional(),
  previous_slugs: uniqueList(key).optional(),
  kind: z.enum(ITEM_KINDS),
  /** British display form. */
  headword: text,
  status: z.enum(CONTENT_STATUSES),
  /** For retired items: the item that replaces it (its pages redirect there). */
  replaced_by: key.optional(),
  /** Shown beside spelling variants ("Both spellings are correct…"). */
  regional_note: text.optional(),
  source: key,
  /** External sources that informed the choice of this item (frequency lists…). */
  informed_by: uniqueList(key).optional(),
  review: z.strictObject({
    author: text,
    reviewer: text.optional(),
    on: isoDate.optional(),
    level: z.enum(REVIEW_LEVELS).optional(),
  }),
  forms: nonEmptyList(formSchema),
  senses: nonEmptyList(senseSchema),
});
export type ItemFile = z.infer<typeof itemSchema>;
export type SenseFile = ItemFile["senses"][number];
export type FramePartFile = SenseFile["frames"][number]["parts"][number];

// ── Expression intents ─────────────────────────────────────────────────────────────────────

export const intentSchema = z.strictObject({
  id: key,
  label: text,
  description: text.optional(),
  function: z.enum(DISCOURSE_FUNCTIONS).optional(),
  /** Phrasings that select this intent: "I want to <trigger>". */
  triggers: uniqueList(text),
  groups: nonEmptyList(
    z.strictObject({
      label: text,
      entries: nonEmptyList(z.strictObject({ sense: senseRef, fit: text })),
    }),
  ),
});
export type IntentFile = z.infer<typeof intentSchema>;
