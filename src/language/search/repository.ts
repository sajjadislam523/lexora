/**
 * What the search service needs from storage: small, indexed lookups over published language.
 * Implemented over PostgreSQL in src/server/repositories/language and in memory for tests.
 * Every method returns published content only.
 */
import type { LanguageContentRepository } from "../engine";
import type { FilterDimension, FilterFacets, SearchFilters } from "../filters";
import type { Span } from "../model";
import type {
  Complement,
  DiscourseFunction,
  FormType,
  ItemKind,
  LinkerConnects,
  LinkerPosition,
  MistakeType,
  Region,
  RelationType,
} from "../schema/vocabulary";

export type FormMatch = {
  itemId: string;
  slug: string;
  headword: string;
  kind: ItemKind;
  /** The normalised form that matched. */
  form: string;
  formType: FormType;
  region?: Region;
  isDefault: boolean;
};

export type SenseRef = {
  id: string;
  itemId: string;
  position: number;
  label?: string;
  standalone: boolean;
};

export type RelationHit = {
  fromSenseId: string;
  toSenseId: string;
  type: RelationType;
  note?: string;
  contextNote?: string;
  weight: number;
};

export type PatternHit = {
  id: string;
  senseId: string;
  base: string;
  preposition: string;
  pattern: string;
  complement: Complement;
  note?: string;
  mistakeId?: string;
  position: number;
};

export type CollocationHit = {
  id: string;
  senseId: string;
  phrase: string;
  pattern?: string;
  note?: string;
  /** The first sense of the full collocation item, when it is published. */
  linkedSenseId?: string;
  /** The first example that shows this collocation. */
  example?: { text: string; highlights: Span[] };
  position: number;
};

export type MistakeHit = {
  id: string;
  senseId: string;
  wrong: string;
  right: string;
  explanation: string;
  type: MistakeType;
};

export type IntentDefinition = {
  id: string;
  label: string;
  function?: DiscourseFunction;
  /** Normalised trigger phrases. */
  triggers: string[];
  /** In authored order. */
  entries: { senseId: string; group: string; fit: string }[];
};

/** A preposition pattern for a context gap; `viaForm` is the item form that found it ("depends on"). */
export type GapPatternHit = { pattern: PatternHit; viaForm?: string };

/** A collocation, or a form of a collocation or phrase item, as a template for a context gap. */
export type CollocationTemplate = {
  /** The collocation's id, or `form:<item>:<form>` for an item form. */
  id: string;
  /** The sense it belongs to (for an item form, the item's first published sense). */
  senseId: string;
  /** The full collocation item: the collocation's linked item, or the form's own item. */
  itemId?: string;
  /** Normalised words. */
  normalized: string;
  /** As authored. */
  display: string;
};

/** A published linker sense: where it goes and what it connects. */
export type LinkerHit = {
  senseId: string;
  headword: string;
  positions: LinkerPosition[];
  connects: LinkerConnects;
  functions: DiscourseFunction[];
};

/** A sense's filterable metadata (kind from its item). */
export type SenseFacets = FilterFacets & { senseId: string };

/**
 * For each filter dimension, how many published senses each value would match together with the
 * other dimensions' selected filters (a dimension's own selection is ignored). Values with no
 * match are absent.
 */
export type FilterCounts = { [D in FilterDimension]: Partial<Record<string, number>> };

/** A verb frame usable for context-gap search: head word, object fillers, prepositions after. */
export type GapFrame = {
  senseId: string;
  head: string;
  fillers: string[];
  /** Normalised prepositions accepted after the object (`in`, `into`). */
  prepositions: string[];
  display: string;
};

export interface LanguageSearchRepository extends Pick<
  LanguageContentRepository,
  "getSenseSummaries"
> {
  /** Items with a form exactly equal to `normalised` (lemma, inflection or spelling variant). */
  findForms(normalised: string): Promise<FormMatch[]>;
  /** Items with a form equal to any of these phrases (for terms inside a longer query). */
  findFormsIn(phrases: readonly string[]): Promise<FormMatch[]>;
  /** Normalised forms and phrases similar to `normalised`, as typo candidates. */
  findTermCandidates(normalised: string): Promise<string[]>;
  /** Preposition-pattern bases similar to `normalised`, as typo candidates. */
  findPatternBaseCandidates(normalised: string): Promise<string[]>;
  findPatternsByBase(normalised: string): Promise<PatternHit[]>;
  findCollocationsByPhrase(normalised: string): Promise<CollocationHit[]>;
  /** Mistakes whose wrong form is, or contains, the normalised phrase. */
  findMistakes(normalised: string): Promise<MistakeHit[]>;
  sensesOfItems(itemIds: readonly string[]): Promise<SenseRef[]>;
  relationsFrom(
    senseIds: readonly string[],
    types: readonly RelationType[],
  ): Promise<RelationHit[]>;
  patternsOf(senseIds: readonly string[]): Promise<PatternHit[]>;
  collocationsOf(senseIds: readonly string[]): Promise<CollocationHit[]>;
  mistakesOf(senseIds: readonly string[]): Promise<MistakeHit[]>;
  listIntents(): Promise<IntentDefinition[]>;
  sensesWithFunction(fn: DiscourseFunction, kinds?: readonly ItemKind[]): Promise<string[]>;
  listGapFrames(): Promise<GapFrame[]>;
  /** Senses whose definition, notes or examples match the words (labelled fallback). */
  fullText(normalised: string): Promise<string[]>;
  /** Filter metadata of these published senses, for restricting a search response. */
  senseFacets(senseIds: readonly string[]): Promise<SenseFacets[]>;
  /**
   * One page of the published senses that match every filter, in browse order: IELTS relevance
   * (core, high, useful), then the item's normalised headword by code point, then sense position.
   */
  browseSenses(
    filters: SearchFilters,
    page: { limit: number; offset: number },
  ): Promise<{ senseIds: string[]; total: number }>;
  filterCounts(filters: SearchFilters): Promise<FilterCounts>;
  /**
   * Context gaps (Step 4.2): patterns whose base is one of `bases`, and patterns of the items
   * that have one of `forms` (inflections such as "depends on"), with the form that matched.
   */
  findGapPatterns(bases: readonly string[], forms: readonly string[]): Promise<GapPatternHit[]>;
  /** Published collocations and collocation/phrase item forms containing any of these words. */
  findCollocationTemplates(words: readonly string[]): Promise<CollocationTemplate[]>;
  /** Every published linker sense with its position and connection details. */
  listLinkers(): Promise<LinkerHit[]>;
}
