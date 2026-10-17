/**
 * Plain-English names for the content model's closed values, as a language page shows them.
 * Presentation only: the values themselves come from the content (src/language/schema).
 */
import type {
  IeltsRelevance,
  IeltsTask,
  LinkerConnects,
  LinkerPosition,
  MistakeType,
  PartOfSpeech,
} from "@/language/schema/vocabulary";
import { IELTS_TASK_LABEL } from "@/language/filter-labels";

export const PART_OF_SPEECH: Record<PartOfSpeech, string> = {
  noun: "noun",
  verb: "verb",
  adjective: "adjective",
  adverb: "adverb",
  conjunction: "conjunction",
  preposition: "preposition",
  noun_phrase: "noun phrase",
  verb_phrase: "verb phrase",
  adjective_phrase: "adjective phrase",
  adverbial_phrase: "adverbial phrase",
  prepositional_phrase: "prepositional phrase",
  clause_frame: "sentence frame",
};

export const MISTAKE_TYPE: Record<MistakeType, string> = {
  preposition: "Preposition",
  collocation: "Collocation",
  word_form: "Word form",
  countability: "Countable or uncountable",
  punctuation: "Punctuation",
  register: "Register",
  confusion: "Easily confused",
  grammar: "Grammar",
};

/** Shared with the Finder's IELTS-use filter, so a task has one name everywhere. */
export const IELTS_TASK: Record<IeltsTask, string> = IELTS_TASK_LABEL;

export const IELTS_RELEVANCE: Record<IeltsRelevance, string> = {
  core: "Core",
  high: "High",
  useful: "Useful",
};

export const LINKER_CONNECTS: Record<LinkerConnects, string> = {
  sentences: "Links two sentences",
  clauses: "Links two clauses in one sentence",
  both: "Links sentences or clauses",
};

const POSITION: Record<LinkerPosition, string> = {
  start: "the start",
  middle: "the middle",
  end: "the end",
};

/** "At the start or in the middle of a sentence". */
export function linkerPositions(positions: readonly LinkerPosition[]) {
  const names = positions.map((position) => POSITION[position]);
  const list =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : (names[0] ?? "");
  return `At ${list} of a sentence`;
}
