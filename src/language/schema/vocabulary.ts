/**
 * The closed value sets of the language model. One list per concept, shared by the content
 * schema (YAML validation), the database enums and the search service, so they can't drift.
 * Adding a value is a content-model change: update the list, generate a migration, document it.
 */

export const ITEM_KINDS = [
  "word",
  "phrase",
  "collocation",
  "preposition_pattern",
  "linker",
  "sentence_pattern",
  "functional_expression",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** `draft` is never shown; `retired` is kept so references keep working, but never shown either. */
export const CONTENT_STATUSES = ["draft", "published", "retired"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Senses are never drafted on their own: they share their item's draft state. */
export const SENSE_STATUSES = ["published", "retired"] as const;
export type SenseStatus = (typeof SENSE_STATUSES)[number];

export const REVIEW_LEVELS = ["editorial", "expert"] as const;
export type ReviewLevel = (typeof REVIEW_LEVELS)[number];

export const FORM_TYPES = ["lemma", "inflection", "spelling_variant", "contraction"] as const;
export type FormType = (typeof FORM_TYPES)[number];

/** `null` in the data means the form is used in both. */
export const REGIONS = ["gb", "us"] as const;
export type Region = (typeof REGIONS)[number];

export const PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "conjunction",
  "preposition",
  "noun_phrase",
  "verb_phrase",
  "adjective_phrase",
  "adverbial_phrase",
  "prepositional_phrase",
  "clause_frame",
] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export const CEFR_LEVELS = ["A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const REGISTERS = ["academic", "formal", "neutral", "informal"] as const;
export type Register = (typeof REGISTERS)[number];

export const SKILLS = ["writing", "speaking"] as const;
export type Skill = (typeof SKILLS)[number];

export const IELTS_RELEVANCE = ["core", "high", "useful"] as const;
export type IeltsRelevance = (typeof IELTS_RELEVANCE)[number];

export const IELTS_TASKS = [
  "writing-1",
  "writing-2",
  "speaking-1",
  "speaking-2",
  "speaking-3",
] as const;
export type IeltsTask = (typeof IELTS_TASKS)[number];

/**
 * What a piece of language does in a text. Expression intents and linker searches ("better
 * linker for contrast") are answered through these.
 */
export const DISCOURSE_FUNCTIONS = [
  "addition",
  "cause",
  "concession",
  "contrast",
  "emphasis",
  "example",
  "importance",
  "increase",
  "problem",
  "result",
] as const;
export type DiscourseFunction = (typeof DISCOURSE_FUNCTIONS)[number];

export const LINKER_CONNECTS = ["sentences", "clauses", "both"] as const;
export type LinkerConnects = (typeof LINKER_CONNECTS)[number];

export const LINKER_POSITIONS = ["start", "middle", "end"] as const;
export type LinkerPosition = (typeof LINKER_POSITIONS)[number];

/** What follows a preposition pattern: `responsible for` + noun / -ing. */
export const COMPLEMENTS = ["noun", "ing", "noun_or_ing", "person", "clause"] as const;
export type Complement = (typeof COMPLEMENTS)[number];

export const MISTAKE_TYPES = [
  "preposition",
  "collocation",
  "word_form",
  "countability",
  "punctuation",
  "register",
  "confusion",
  "grammar",
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

/** Slots in a frame: `invest` [object] `in` [noun]. */
export const SLOT_TYPES = ["object", "noun", "ing", "clause", "adjective", "person"] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

/**
 * Typed, sense-to-sense relations. Authors write each relation once; the importer writes the
 * inverse (`stronger` → `weaker`, symmetric types → the same type), so queries read one direction.
 */
export const RELATION_TYPES = [
  "synonym",
  "alternative",
  "stronger",
  "weaker",
  "more_formal",
  "more_natural",
  "opposite",
  "confusable",
  "has_component",
  "component_of",
  "derived_form",
  "related",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** The types an author may write. The other four only exist as inverses written by the importer. */
export const AUTHORED_RELATION_TYPES = [
  "synonym",
  "alternative",
  "stronger",
  "more_formal",
  "opposite",
  "confusable",
  "has_component",
  "derived_form",
  "related",
] as const satisfies readonly RelationType[];
export type AuthoredRelationType = (typeof AUTHORED_RELATION_TYPES)[number];

export const INVERSE_RELATION: Record<AuthoredRelationType, RelationType> = {
  synonym: "synonym",
  alternative: "alternative",
  stronger: "weaker",
  more_formal: "more_natural",
  opposite: "opposite",
  confusable: "confusable",
  has_component: "component_of",
  derived_form: "derived_form",
  related: "related",
};

/** Relation types whose note explains the difference, and so must be written. */
export const RELATION_TYPES_NEEDING_NOTE = new Set<RelationType>([
  "synonym",
  "alternative",
  "stronger",
  "more_formal",
  "confusable",
  "derived_form",
]);

export const SOURCE_KINDS = [
  "editorial",
  "open_dataset",
  "licensed",
  "public_domain",
  "reference",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** What a source may contribute. The validator rejects content that uses a source beyond these. */
export const SOURCE_USES = [
  "definitions",
  "examples",
  "relations",
  "notes",
  "frequency",
  "candidates",
  "mistakes",
] as const;
export type SourceUse = (typeof SOURCE_USES)[number];
