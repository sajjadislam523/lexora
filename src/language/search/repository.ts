/**
 * What the search service needs from storage: small, indexed lookups over published language.
 * Implemented over PostgreSQL in src/server/repositories/language and in memory for tests.
 * Every method returns published content only.
 */
import type { LanguageContentRepository } from "../engine";
import type { Span } from "../model";
import type {
  Complement,
  DiscourseFunction,
  FormType,
  ItemKind,
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
}
