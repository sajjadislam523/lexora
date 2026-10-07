/**
 * The language engine's domain model: what pages and search results render. It describes
 * published language only — drafts and retired content never reach it — and holds no learner
 * data; personal state (saved senses) is fetched separately and shown alongside.
 */
import type {
  CefrLevel,
  Complement,
  DiscourseFunction,
  FormType,
  IeltsRelevance,
  IeltsTask,
  ItemKind,
  LinkerConnects,
  LinkerPosition,
  MistakeType,
  PartOfSpeech,
  Region,
  Register,
  RelationType,
  Skill,
  SlotType,
} from "./schema/vocabulary";

/** A character range `[start, end)` to highlight in an example. */
export type Span = { start: number; end: number };

export type LanguageExample = {
  id: string;
  text: string;
  highlights: Span[];
  skill: Skill;
  task?: IeltsTask;
  /** The collocation or preposition pattern (local to the sense) this example shows. */
  collocationId?: string;
  prepositionPatternId?: string;
};

export type Collocation = {
  id: string;
  phrase: string;
  pattern?: string;
  note?: string;
  /** The slug of the full collocation item, when Lexora has one. */
  itemSlug?: string;
};

export type PrepositionPattern = {
  id: string;
  base: string;
  preposition: string;
  pattern: string;
  complement: Complement;
  note?: string;
};

export type FramePart =
  | { text: string; head?: boolean; also?: string[] }
  | { slot: SlotType; hint?: string; fillers?: string[] };

export type Frame = { id: string; display: string; parts: FramePart[] };

export type Mistake = {
  id: string;
  wrong: string;
  right: string;
  explanation: string;
  type: MistakeType;
};

export type LinkerUsage = {
  connects: LinkerConnects;
  positions: LinkerPosition[];
  punctuation: string;
};

/** Another sense this one relates to, with the note that explains the difference. */
export type RelatedSense = {
  type: RelationType;
  senseId: string;
  slug: string;
  headword: string;
  senseLabel?: string;
  definition: string;
  note?: string;
  contextNote?: string;
  weight: number;
};

export type Sense = {
  id: string;
  label?: string;
  partOfSpeech: PartOfSpeech;
  definition: string;
  cefr: CefrLevel;
  registers: Register[];
  skills: Skill[];
  ieltsRelevance: IeltsRelevance;
  ieltsTasks: IeltsTask[];
  strength?: 1 | 2 | 3;
  functions: DiscourseFunction[];
  bestWhen: string;
  avoidWhen?: string;
  skillNote?: string;
  linker?: LinkerUsage;
  examples: LanguageExample[];
  collocations: Collocation[];
  prepositionPatterns: PrepositionPattern[];
  frames: Frame[];
  mistakes: Mistake[];
  /** Grouped by type in authored weight order, strongest first. */
  relations: RelatedSense[];
};

export type ItemForm = { form: string; type: FormType; region?: Region };

/** A published language item with everything its page shows. */
export type LanguageDetail = {
  id: string;
  slug: string;
  kind: ItemKind;
  headword: string;
  /** Every form search recognises, default first (spelling variants, inflections). */
  forms: ItemForm[];
  regionalNote?: string;
  senses: Sense[];
  source: { name: string; attribution?: string };
};

/** An old or retired slug: the page that now answers it. */
export type SlugRedirect = { redirectTo: string };

/** The short form of a sense used on result cards and in saved language. */
export type SenseSummary = {
  senseId: string;
  slug: string;
  headword: string;
  kind: ItemKind;
  senseLabel?: string;
  definition: string;
  bestWhen: string;
  registers: Register[];
  skills: Skill[];
  strength?: 1 | 2 | 3;
  ieltsRelevance: IeltsRelevance;
  example?: { text: string; highlights: Span[] };
  collocations: string[];
  /** The first preposition pattern, for pattern items ("be responsible for + noun / -ing"). */
  pattern?: string;
};
