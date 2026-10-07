import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import {
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
  RELATION_TYPES,
  REVIEW_LEVELS,
  SENSE_STATUSES,
  SKILLS,
  SOURCE_KINDS,
  SOURCE_USES,
} from "@/language/schema/vocabulary";

/**
 * The language engine's content: global, published language with no user columns. Written only
 * by the content importer (`pnpm content:import`) from the YAML in `content/`, and read only
 * through src/server/repositories/language.
 *
 * IDs are the authored keys (`significant`, `significant.notable`, `significant.notable:ex1`), so
 * a re-import never changes them. Items and senses are never deleted, only retired; user data
 * references senses.
 */

export const itemKind = pgEnum("item_kind", ITEM_KINDS);
export const contentStatus = pgEnum("content_status", CONTENT_STATUSES);
export const senseStatus = pgEnum("sense_status", SENSE_STATUSES);
export const reviewLevel = pgEnum("review_level", REVIEW_LEVELS);
export const formType = pgEnum("form_type", FORM_TYPES);
export const region = pgEnum("region", REGIONS);
export const partOfSpeech = pgEnum("part_of_speech", PARTS_OF_SPEECH);
export const cefrLevel = pgEnum("cefr_level", CEFR_LEVELS);
export const register = pgEnum("register", REGISTERS);
export const skill = pgEnum("skill", SKILLS);
export const ieltsRelevance = pgEnum("ielts_relevance", IELTS_RELEVANCE);
export const ieltsTask = pgEnum("ielts_task", IELTS_TASKS);
export const discourseFunction = pgEnum("discourse_function", DISCOURSE_FUNCTIONS);
export const linkerConnects = pgEnum("linker_connects", LINKER_CONNECTS);
export const linkerPosition = pgEnum("linker_position", LINKER_POSITIONS);
export const complement = pgEnum("complement", COMPLEMENTS);
export const mistakeType = pgEnum("mistake_type", MISTAKE_TYPES);
export const relationType = pgEnum("relation_type", RELATION_TYPES);
export const sourceKind = pgEnum("source_kind", SOURCE_KINDS);
export const sourceUse = pgEnum("source_use", SOURCE_USES);

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/** A character range in an example's text: `[start, end)`. */
export type HighlightSpan = { start: number; end: number };

/** A frame part as stored: literal text or a typed slot (see content/README.md → Frames). */
export type StoredFramePart =
  | { text: string; head?: boolean; also?: string[] }
  | { slot: string; hint?: string; fillers?: string[] };

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ── Provenance ─────────────────────────────────────────────────────────────────────────────

export const contentSources = pgTable("content_sources", {
  id: text().primaryKey(),
  name: text().notNull(),
  kind: sourceKind().notNull(),
  licence: text().notNull(),
  licenceUrl: text(),
  attribution: text(),
  url: text(),
  permittedUses: sourceUse().array().notNull(),
  verifiedOn: date(),
});

/** One row per import that changed something. */
export const contentReleases = pgTable("content_releases", {
  id: serial().primaryKey(),
  gitSha: text(),
  /** SHA-256 of the validated content; an import with the same checksum changes nothing. */
  checksum: text().notNull(),
  counts: jsonb().$type<Record<string, number>>().notNull(),
  importedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ── Items, forms and senses ────────────────────────────────────────────────────────────────

export const languageItems = pgTable(
  "language_items",
  {
    id: text().primaryKey(),
    slug: text().notNull().unique(),
    kind: itemKind().notNull(),
    headword: text().notNull(),
    normalized: text().notNull(),
    status: contentStatus().notNull(),
    replacedBy: text().references((): AnyPgColumn => languageItems.id),
    regionalNote: text(),
    sourceId: text()
      .notNull()
      .references(() => contentSources.id),
    informedBy: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    authoredBy: text().notNull(),
    reviewedBy: text(),
    reviewedOn: date(),
    reviewLevel: reviewLevel(),
    releaseId: integer().references(() => contentReleases.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("language_items_status_idx").on(table.status)],
);

/** Earlier slugs of an item, so old links redirect (308) instead of breaking. */
export const itemSlugHistory = pgTable("item_slug_history", {
  slug: text().primaryKey(),
  itemId: text()
    .notNull()
    .references(() => languageItems.id),
});

export const itemForms = pgTable(
  "item_forms",
  {
    id: serial().primaryKey(),
    itemId: text()
      .notNull()
      .references(() => languageItems.id, { onDelete: "cascade" }),
    form: text().notNull(),
    normalized: text().notNull(),
    formType: formType().notNull(),
    region: region(),
    isDefault: boolean().notNull().default(false),
  },
  (table) => [
    unique("item_forms_item_normalized_key").on(table.itemId, table.normalized),
    index("item_forms_normalized_idx").on(table.normalized),
    index("item_forms_normalized_trgm_idx").using("gin", table.normalized.op("gin_trgm_ops")),
  ],
);

export const senses = pgTable(
  "senses",
  {
    id: text().primaryKey(),
    itemId: text()
      .notNull()
      .references(() => languageItems.id),
    position: smallint().notNull(),
    status: senseStatus().notNull().default("published"),
    replacedBy: text().references((): AnyPgColumn => senses.id),
    label: text(),
    definition: text().notNull(),
    partOfSpeech: partOfSpeech().notNull(),
    cefr: cefrLevel().notNull(),
    registers: register().array().notNull(),
    skills: skill().array().notNull(),
    ieltsRelevance: ieltsRelevance().notNull(),
    ieltsTasks: ieltsTask().array().notNull(),
    strength: smallint(),
    functions: discourseFunction()
      .array()
      .notNull()
      .default(sql`'{}'`),
    bestWhen: text().notNull(),
    avoidWhen: text(),
    skillNote: text(),
    standaloneReason: text(),
    /** Built by the importer from the definition, best-when note and examples ('english'). */
    searchVector: tsvector(),
  },
  (table) => [
    index("senses_item_position_idx").on(table.itemId, table.position),
    index("senses_search_vector_idx").using("gin", table.searchVector),
    check(
      "senses_strength_range",
      sql`${table.strength} is null or ${table.strength} between 1 and 3`,
    ),
  ],
);

export const linkerDetails = pgTable("linker_details", {
  senseId: text()
    .primaryKey()
    .references(() => senses.id, { onDelete: "cascade" }),
  connects: linkerConnects().notNull(),
  positions: linkerPosition().array().notNull(),
  punctuation: text().notNull(),
});

// ── What hangs off a sense ─────────────────────────────────────────────────────────────────

export const mistakes = pgTable(
  "mistakes",
  {
    id: text().primaryKey(),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    wrong: text().notNull(),
    wrongNormalized: text().notNull(),
    right: text().notNull(),
    explanation: text().notNull(),
    type: mistakeType().notNull(),
    position: smallint().notNull(),
  },
  (table) => [
    index("mistakes_wrong_normalized_idx").on(table.wrongNormalized),
    index("mistakes_wrong_normalized_trgm_idx").using(
      "gin",
      table.wrongNormalized.op("gin_trgm_ops"),
    ),
  ],
);

export const collocations = pgTable(
  "collocations",
  {
    id: text().primaryKey(),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    phrase: text().notNull(),
    normalized: text().notNull(),
    pattern: text(),
    note: text(),
    registers: register().array(),
    skills: skill().array(),
    itemId: text().references(() => languageItems.id),
    position: smallint().notNull(),
  },
  (table) => [
    index("collocations_sense_idx").on(table.senseId),
    index("collocations_normalized_idx").on(table.normalized),
    index("collocations_normalized_trgm_idx").using("gin", table.normalized.op("gin_trgm_ops")),
  ],
);

export const prepositionPatterns = pgTable(
  "preposition_patterns",
  {
    id: text().primaryKey(),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    base: text().notNull(),
    baseNormalized: text().notNull(),
    preposition: text().notNull(),
    pattern: text().notNull(),
    complement: complement().notNull(),
    note: text(),
    mistakeId: text().references(() => mistakes.id),
    position: smallint().notNull(),
  },
  (table) => [
    index("preposition_patterns_base_normalized_idx").on(table.baseNormalized),
    index("preposition_patterns_base_normalized_trgm_idx").using(
      "gin",
      table.baseNormalized.op("gin_trgm_ops"),
    ),
  ],
);

export const examples = pgTable(
  "examples",
  {
    id: text().primaryKey(),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    text: text().notNull(),
    highlights: jsonb().$type<HighlightSpan[]>().notNull(),
    skill: skill().notNull(),
    ieltsTask: ieltsTask(),
    collocationId: text().references(() => collocations.id),
    prepositionPatternId: text().references(() => prepositionPatterns.id),
    position: smallint().notNull(),
    sourceId: text()
      .notNull()
      .references(() => contentSources.id),
  },
  (table) => [index("examples_sense_position_idx").on(table.senseId, table.position)],
);

export const frames = pgTable(
  "frames",
  {
    id: text().primaryKey(),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    parts: jsonb().$type<StoredFramePart[]>().notNull(),
    display: text().notNull(),
    headNormalized: text().notNull(),
    position: smallint().notNull(),
  },
  (table) => [index("frames_head_normalized_idx").on(table.headNormalized)],
);

export const senseRelations = pgTable(
  "relations",
  {
    fromSenseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    toSenseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    type: relationType().notNull(),
    note: text(),
    contextNote: text(),
    weight: smallint().notNull(),
    /** Written by the importer as the mirror of an authored relation. */
    isInverse: boolean().notNull(),
    sourceId: text()
      .notNull()
      .references(() => contentSources.id),
  },
  (table) => [
    primaryKey({ columns: [table.fromSenseId, table.toSenseId, table.type] }),
    index("relations_from_type_idx").on(table.fromSenseId, table.type),
    check("relations_weight_range", sql`${table.weight} between 1 and 3`),
    check("relations_not_self", sql`${table.fromSenseId} <> ${table.toSenseId}`),
  ],
);

// ── Expression intents ("I want to express contrast") ──────────────────────────────────────

export const intents = pgTable("intents", {
  id: text().primaryKey(),
  label: text().notNull(),
  description: text(),
  function: discourseFunction(),
});

export const intentTriggers = pgTable(
  "intent_triggers",
  {
    intentId: text()
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    phrase: text().notNull(),
    normalized: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.intentId, table.normalized] }),
    index("intent_triggers_normalized_trgm_idx").using("gin", table.normalized.op("gin_trgm_ops")),
  ],
);

export const intentEntries = pgTable(
  "intent_entries",
  {
    intentId: text()
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    senseId: text()
      .notNull()
      .references(() => senses.id, { onDelete: "cascade" }),
    groupLabel: text().notNull(),
    position: smallint().notNull(),
    fitNote: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.intentId, table.senseId] })],
);

// ── Relational queries ─────────────────────────────────────────────────────────────────────

export const languageItemsRelations = relations(languageItems, ({ many, one }) => ({
  forms: many(itemForms),
  senses: many(senses),
  source: one(contentSources, {
    fields: [languageItems.sourceId],
    references: [contentSources.id],
  }),
}));

export const itemFormsRelations = relations(itemForms, ({ one }) => ({
  item: one(languageItems, { fields: [itemForms.itemId], references: [languageItems.id] }),
}));

export const sensesRelations = relations(senses, ({ one, many }) => ({
  item: one(languageItems, { fields: [senses.itemId], references: [languageItems.id] }),
  linker: one(linkerDetails, { fields: [senses.id], references: [linkerDetails.senseId] }),
  examples: many(examples),
  collocations: many(collocations),
  prepositionPatterns: many(prepositionPatterns),
  frames: many(frames),
  mistakes: many(mistakes),
  relations: many(senseRelations, { relationName: "from" }),
  incomingRelations: many(senseRelations, { relationName: "to" }),
}));

export const linkerDetailsRelations = relations(linkerDetails, ({ one }) => ({
  sense: one(senses, { fields: [linkerDetails.senseId], references: [senses.id] }),
}));

export const examplesRelations = relations(examples, ({ one }) => ({
  sense: one(senses, { fields: [examples.senseId], references: [senses.id] }),
}));

export const collocationsRelations = relations(collocations, ({ one }) => ({
  sense: one(senses, { fields: [collocations.senseId], references: [senses.id] }),
}));

export const prepositionPatternsRelations = relations(prepositionPatterns, ({ one }) => ({
  sense: one(senses, { fields: [prepositionPatterns.senseId], references: [senses.id] }),
}));

export const framesRelations = relations(frames, ({ one }) => ({
  sense: one(senses, { fields: [frames.senseId], references: [senses.id] }),
}));

export const mistakesRelations = relations(mistakes, ({ one }) => ({
  sense: one(senses, { fields: [mistakes.senseId], references: [senses.id] }),
}));

export const senseRelationsRelations = relations(senseRelations, ({ one }) => ({
  from: one(senses, {
    fields: [senseRelations.fromSenseId],
    references: [senses.id],
    relationName: "from",
  }),
  to: one(senses, {
    fields: [senseRelations.toSenseId],
    references: [senses.id],
    relationName: "to",
  }),
}));

export const intentsRelations = relations(intents, ({ many }) => ({
  triggers: many(intentTriggers),
  entries: many(intentEntries),
}));

export const intentTriggersRelations = relations(intentTriggers, ({ one }) => ({
  intent: one(intents, { fields: [intentTriggers.intentId], references: [intents.id] }),
}));

export const intentEntriesRelations = relations(intentEntries, ({ one }) => ({
  intent: one(intents, { fields: [intentEntries.intentId], references: [intents.id] }),
  sense: one(senses, { fields: [intentEntries.senseId], references: [senses.id] }),
}));
