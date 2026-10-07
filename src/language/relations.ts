/**
 * How relation types are named to learners, shared by search results and language pages so the
 * same relation never reads differently in two places. Client-safe.
 */
import type { RelationType } from "./schema/vocabulary";

/** In a reason: "Stronger than important". */
export const RELATION_PHRASE: Record<RelationType, string> = {
  synonym: "Similar to",
  alternative: "An alternative to",
  stronger: "Stronger than",
  weaker: "Weaker than",
  more_formal: "More formal than",
  more_natural: "More natural than",
  opposite: "Opposite of",
  confusable: "Often confused with",
  has_component: "Contains",
  component_of: "Uses",
  derived_form: "Another form of",
  related: "Related to",
};

/** Group headings for related language, in display order. */
export const RELATION_GROUPS: { label: string; types: RelationType[] }[] = [
  { label: "Similar meaning", types: ["synonym"] },
  { label: "Stronger", types: ["stronger"] },
  { label: "Alternatives", types: ["alternative"] },
  { label: "More formal", types: ["more_formal"] },
  { label: "More natural", types: ["more_natural"] },
  { label: "Weaker", types: ["weaker"] },
  { label: "Often confused", types: ["confusable"] },
  { label: "Opposite", types: ["opposite"] },
  { label: "Used in", types: ["component_of"] },
  { label: "Part of this phrase", types: ["has_component"] },
  { label: "Other forms", types: ["derived_form"] },
  { label: "Related", types: ["related"] },
];
