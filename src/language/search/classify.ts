/**
 * Reads the shape of a question. An ordered list of patterns over the normalised query; the
 * first that matches wins and extracts a term (a word or phrase to look up) or a phrase (an idea
 * to express), plus modifiers. Adding a phrasing means adding a pattern and a test.
 */
import { GAP_TOKEN } from "../normalise";
import type { DiscourseFunction } from "../schema/vocabulary";

import type { Modifier, QueryIntent } from "./types";

export type Classification = {
  intent: QueryIntent;
  /** The word or phrase the question is about ("important" in "better word for important"). */
  term?: string;
  /** The idea to express ("express contrast" in "I want to express contrast"). */
  phrase?: string;
  /** For linker questions: the discourse function asked for. */
  function?: DiscourseFunction;
  modifiers: Modifier[];
};

const MODIFIER_WORDS: Record<string, Modifier[]> = {
  natural: ["natural"],
  spoken: ["speaking"],
  speaking: ["speaking"],
  conversational: ["speaking", "natural"],
  casual: ["informal"],
  informal: ["informal"],
  formal: ["formal"],
  academic: ["academic"],
  written: ["writing"],
  writing: ["writing"],
  essay: ["writing"],
};

/** Words that name a discourse function, for linker and expression questions. */
const FUNCTION_WORDS: Record<string, DiscourseFunction> = {
  contrast: "contrast",
  contrasting: "contrast",
  difference: "contrast",
  differences: "contrast",
  addition: "addition",
  adding: "addition",
  add: "addition",
  example: "example",
  examples: "example",
  instance: "example",
  result: "result",
  results: "result",
  consequence: "result",
  consequences: "result",
  effect: "result",
  effects: "result",
  cause: "cause",
  causes: "cause",
  reason: "cause",
  reasons: "cause",
  concession: "concession",
  conceding: "concession",
  concede: "concession",
  emphasis: "emphasis",
  emphasising: "emphasis",
  importance: "importance",
  increase: "increase",
  increases: "increase",
  rise: "increase",
  growth: "increase",
  problem: "problem",
  problems: "problem",
};

export function functionIn(phrase: string): DiscourseFunction | undefined {
  for (const word of phrase.split(" ")) {
    const fn = FUNCTION_WORDS[word];
    if (fn) return fn;
  }
  return undefined;
}

function modifiersIn(words: string | undefined): Modifier[] {
  const found = new Set<Modifier>();
  for (const word of (words ?? "").split(" ")) {
    for (const modifier of MODIFIER_WORDS[word] ?? []) found.add(modifier);
  }
  return [...found];
}

/** Strips quotes and a trailing question mark from an extracted term. */
function cleanTerm(term: string) {
  return term
    .replace(/[?]+$/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
}

const QUALIFIERS =
  "(?:(?:a|an|the|some|good|better|best|more|other|another|different|nice|natural|spoken|speaking|conversational|casual|informal|formal|academic|written|writing|essay|common|useful)\\s+)*";
const WORD = "(?:words?|terms?|synonyms?|expressions?|ways?|options?|alternatives?)";
const PREPOSITIONS = "(?:in|on|at|for|of|to|with|about|from|into|by)";

type Rule = {
  intent: QueryIntent;
  pattern: RegExp;
  /** Which capture holds the term; which holds qualifier words for modifiers. */
  slot: "term" | "phrase";
};

/** Ordered: specific shapes first, the open "I want to …" last. */
const RULES: Rule[] = [
  // Prepositions.
  {
    intent: "PREPOSITION",
    pattern: new RegExp(
      `^(?:what|which)?\\s*(?:prepositions?|preps?)\\s+(?:comes?\\s+|goes?\\s+|do i use\\s+|to use\\s+|is used\\s+|should i use\\s+)?(?:after|with|for|follows?)\\s+(.+)$`,
    ),
    slot: "term",
  },
  { intent: "PREPOSITION", pattern: /^what (?:comes|goes) after (.+)$/, slot: "term" },
  { intent: "PREPOSITION", pattern: /^(.+?) (?:\+ ?\?|preposition|prepositions)$/, slot: "term" },
  {
    intent: "PREPOSITION",
    pattern: new RegExp(`^(.+?) ${PREPOSITIONS} or ${PREPOSITIONS}\\??$`),
    slot: "term",
  },
  // Stronger and weaker.
  {
    intent: "STRONGER_ALTERNATIVE",
    pattern: new RegExp(
      `^${QUALIFIERS}(?:stronger|more emphatic|more powerful)\\s+(?:${WORD}\\s+)?(?:for|than|to say|to|of)\\s+(.+)$`,
    ),
    slot: "term",
  },
  { intent: "STRONGER_ALTERNATIVE", pattern: /^(.+?) but stronger$/, slot: "term" },
  {
    intent: "WEAKER_ALTERNATIVE",
    pattern: new RegExp(
      `^${QUALIFIERS}(?:weaker|softer|milder|less strong)\\s+(?:${WORD}\\s+)?(?:for|than|to say|to|of)\\s+(.+)$`,
    ),
    slot: "term",
  },
  // Alternatives, with register modifiers.
  {
    intent: "ALTERNATIVE",
    pattern: new RegExp(`^(${QUALIFIERS})alternatives?\\s+(?:to|for|of)\\s+(.+)$`),
    slot: "term",
  },
  { intent: "ALTERNATIVE", pattern: /^(?:how (?:can|do|should) i )?replace (.+)$/, slot: "term" },
  { intent: "ALTERNATIVE", pattern: /^(.+?) alternatives?$/, slot: "term" },
  // Synonyms.
  {
    intent: "SYNONYM",
    pattern: new RegExp(`^(${QUALIFIERS})(?:words?|terms?|synonyms?)\\s+(?:for|to|of)\\s+(.+)$`),
    slot: "term",
  },
  { intent: "SYNONYM", pattern: /^(.+?) synonyms?$/, slot: "term" },
  {
    intent: "SYNONYM",
    pattern: /^(?:what (?:can|could|should) i (?:use|say) )?instead of (.+)$/,
    slot: "term",
  },
  {
    intent: "SYNONYM",
    pattern: /^(?:(another|a better|a different|a more \w+) )?way to say (.+)$/,
    slot: "term",
  },
  // Collocations.
  {
    intent: "COLLOCATION",
    pattern:
      /^(?:collocations?|words?|nouns?|verbs?|adjectives?)\s+(?:with|for|used with|that go with|that collocate with|to use with)\s+(.+)$/,
    slot: "term",
  },
  { intent: "COLLOCATION", pattern: /^what (?:words? )?goes? with (.+)$/, slot: "term" },
  { intent: "COLLOCATION", pattern: /^(.+?) (?:collocations?|\+ noun)$/, slot: "term" },
  // Linkers.
  {
    intent: "LINKER",
    pattern: new RegExp(
      `^${QUALIFIERS}(?:linkers?|linking (?:words?|phrases?)|connectors?|connectives?|transitions?|transition words?|discourse markers?)\\s+(?:for|to show|to express|of|to)\\s+(.+)$`,
    ),
    slot: "phrase",
  },
  // Phrases and sentence patterns.
  {
    intent: "SENTENCE_PATTERN",
    pattern:
      /^(?:a |the )?(?:sentence )?(?:patterns?|structures?|frames?|starters?|sentence starters?)\s+(?:for|to|about)\s+(.+)$/,
    slot: "phrase",
  },
  {
    intent: "SENTENCE_PATTERN",
    pattern:
      /^how (?:to|do i|can i|should i) (?:start|begin|open|introduce) (?:a |an |my |the )?(?:sentence|paragraph|essay|introduction)? ?(?:about|on|with|that)? ?(.+)$/,
    slot: "phrase",
  },
  {
    intent: "PHRASE",
    pattern: new RegExp(`^${QUALIFIERS}(?:phrases?|expressions?)\\s+(?:for|to|of|about)\\s+(.+)$`),
    slot: "phrase",
  },
  // "I want to …": the idea is matched against expression intents.
  {
    intent: "CONTEXTUAL_EXPRESSION",
    pattern:
      /^(?:i(?: want| need| would like|'d like| wanna| am trying|'m trying) to|how (?:do|can|should|could) i|how to|help me) (.+)$/,
    slot: "phrase",
  },
];

export function classify(normalised: string): Classification {
  if (normalised.split(" ").includes(GAP_TOKEN)) {
    return { intent: "CONTEXT_GAP", phrase: normalised, modifiers: [] };
  }

  for (const rule of RULES) {
    const match = rule.pattern.exec(normalised);
    if (!match) continue;
    // With two captures, the first holds qualifier words ("natural speaking ").
    const [qualifiers, captured] = match.length > 2 ? [match[1], match[2]] : [undefined, match[1]];
    const value = cleanTerm(captured ?? "");
    if (!value) continue;

    const modifiers = modifiersIn(qualifiers);
    if (rule.slot === "term") return { intent: rule.intent, term: value, modifiers };
    const fn = functionIn(value);
    return {
      intent: rule.intent,
      phrase: value,
      ...(fn && { function: fn }),
      modifiers,
    };
  }

  return { intent: "LOOKUP", term: cleanTerm(normalised), modifiers: [] };
}
