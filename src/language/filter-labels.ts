/**
 * What learners see for each filter value (Phase 4 filters, src/language/filters.ts). The one
 * place these names live: the Finder's filters and the language page both read them. Client-safe.
 */
import type { FilterDimension, IeltsUse } from "./filters";
import type { DiscourseFunction, IeltsTask, ItemKind, Topic } from "./schema/vocabulary";

export const FILTER_LABEL: Record<FilterDimension, string> = {
  kind: "Kind",
  function: "Function",
  use: "IELTS use",
  topic: "Topic",
};

export const KIND_LABEL: Record<ItemKind, string> = {
  word: "Word",
  phrase: "Phrase",
  collocation: "Collocation",
  preposition_pattern: "Preposition pattern",
  linker: "Linker",
  sentence_pattern: "Sentence pattern",
  functional_expression: "Functional expression",
};

export const FUNCTION_LABEL: Record<DiscourseFunction, string> = {
  addition: "Adding a point",
  cause: "Cause",
  comparison: "Comparison",
  concession: "Conceding a point",
  contrast: "Contrast",
  decrease: "Decrease",
  emphasis: "Emphasis",
  example: "Giving examples",
  hedging: "Softening a claim",
  importance: "Importance",
  increase: "Increase",
  opinion: "Opinion",
  problem: "Describing a problem",
  result: "Result",
};

export const IELTS_TASK_LABEL: Record<IeltsTask, string> = {
  "writing-1": "Writing Task 1",
  "writing-2": "Writing Task 2",
  "speaking-1": "Speaking Part 1",
  "speaking-2": "Speaking Part 2",
  "speaking-3": "Speaking Part 3",
};

export const IELTS_USE_LABEL: Record<IeltsUse, string> = {
  writing: "Writing (any task)",
  "writing-1": IELTS_TASK_LABEL["writing-1"],
  "writing-2": IELTS_TASK_LABEL["writing-2"],
  speaking: "Speaking (any part)",
  "speaking-1": IELTS_TASK_LABEL["speaking-1"],
  "speaking-2": IELTS_TASK_LABEL["speaking-2"],
  "speaking-3": IELTS_TASK_LABEL["speaking-3"],
};

export const TOPIC_LABEL: Record<Topic, string> = {
  education: "Education",
  environment: "Environment",
  health: "Health",
  technology: "Technology and media",
  work: "Work and careers",
  economy: "Economy and business",
  government: "Government and policy",
  cities: "Cities and housing",
  transport: "Transport",
  society: "Society and culture",
};

/** The label of any filter value. */
export function filterValueLabel(dimension: FilterDimension, value: string) {
  const labels: Record<FilterDimension, Record<string, string>> = {
    kind: KIND_LABEL,
    function: FUNCTION_LABEL,
    use: IELTS_USE_LABEL,
    topic: TOPIC_LABEL,
  };
  return labels[dimension][value] ?? value;
}
