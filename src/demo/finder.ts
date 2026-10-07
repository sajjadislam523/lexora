/**
 * Prototype content — NOT search.
 * A fixed set of example searches with hand-written results. LanguageSearchService
 * (src/language) matches typed queries to these by keyword.
 * Real retrieval (query parsing, intent library, FTS + trigram) arrives in Phase 4.
 */
import type { GapPart } from "@/components/lexora/gap-sentence";
import type { Fit } from "@/components/lexora/fit-badge";

export const SEARCH_MODES = [
  { id: "word", label: "Word", placeholder: "better word for important" },
  { id: "phrase", label: "Phrase", placeholder: "phrase for giving an example" },
  { id: "preposition", label: "Preposition", placeholder: "preposition after responsible" },
  {
    id: "collocation",
    label: "Collocation",
    placeholder: "I want to say something increased significantly",
  },
  { id: "linker", label: "Linker", placeholder: "alternative to however" },
  {
    id: "expression",
    label: "Expression",
    placeholder: "natural speaking alternative to furthermore",
  },
  {
    id: "context",
    label: "Context",
    placeholder: "Governments should ___ more money to public transport",
  },
] as const;

export type SearchMode = (typeof SEARCH_MODES)[number]["id"];

export type DemoQuery = {
  id: string;
  text: string;
  mode: SearchMode;
  /** Any of these words in the typed query selects this demo query. Checked in list order. */
  match: string[];
  understoodAs: string;
  /** Result item slugs, in ranked order. Empty for the context query. */
  results: string[];
  guide?: { title: string; rows: { term: string; when: string }[]; note?: string };
  /** Show the writing vs speaking comparison for this slug. */
  skillPairFrom?: string;
  related?: string[];
};

export const DEMO_QUERIES: DemoQuery[] = [
  {
    id: "furthermore",
    text: "natural speaking alternative to furthermore",
    mode: "expression",
    match: ["furthermore", "moreover"],
    understoodAs: "Spoken alternatives to “furthermore”",
    results: ["on-top-of-that", "whats-more", "furthermore"],
    guide: {
      title: "Which one fits?",
      rows: [
        { term: "on top of that", when: "adding a point in conversation, often a complaint" },
        { term: "what's more", when: "adding a stronger point, speaking or informal writing" },
        { term: "furthermore", when: "formal essays — sounds stiff when spoken" },
      ],
    },
    skillPairFrom: "furthermore",
    related: ["alternative to however", "phrase for giving an example"],
  },
  {
    id: "responsible",
    text: "preposition after responsible",
    mode: "preposition",
    match: ["responsible", "responsibility"],
    understoodAs: "The preposition after “responsible”",
    results: ["responsible-for"],
    guide: {
      title: "Which preposition?",
      rows: [
        { term: "responsible for", when: "+ the task, thing or result" },
        { term: "responsible to", when: "+ the person or body you report to" },
      ],
      note: "“Responsible of” is never correct.",
    },
    related: ["better word for important"],
  },
  {
    id: "however",
    text: "alternative to however",
    mode: "linker",
    match: ["however"],
    understoodAs: "Alternatives to “however” — contrast between sentences",
    results: ["nevertheless", "on-the-other-hand", "in-contrast", "whereas"],
    guide: {
      title: "Which one fits?",
      rows: [
        { term: "nevertheless", when: "concede a point, then continue anyway" },
        { term: "on the other hand", when: "the second side of an argument" },
        { term: "in contrast", when: "a clear difference between two things" },
        { term: "whereas", when: "a contrast inside one sentence" },
      ],
      note: "They aren't interchangeable: “on the other hand” needs two sides of the same issue.",
    },
    related: ["I want to express contrast", "natural speaking alternative to furthermore"],
  },
  {
    id: "contrast",
    text: "I want to express contrast",
    mode: "linker",
    match: ["contrast", "contrasting", "opposite"],
    understoodAs: "Language for contrast",
    results: ["whereas", "in-contrast", "on-the-other-hand", "however"],
    guide: {
      title: "Which one fits?",
      rows: [
        { term: "whereas", when: "two facts in one sentence" },
        { term: "in contrast", when: "comparing groups or figures (Task 1)" },
        { term: "on the other hand", when: "two sides of an argument (Task 2)" },
        { term: "however", when: "general contrast between sentences" },
      ],
    },
    related: ["alternative to however"],
  },
  {
    id: "example",
    text: "phrase for giving an example",
    mode: "phrase",
    match: ["example", "examples", "instance", "illustrate"],
    understoodAs: "Ways to introduce an example",
    results: ["for-instance", "such-as", "a-case-in-point"],
    guide: {
      title: "Which one fits?",
      rows: [
        { term: "such as", when: "inside a sentence, before nouns" },
        { term: "for instance", when: "a clause or a full sentence" },
        { term: "a case in point", when: "one strong example that proves your claim" },
      ],
    },
    related: ["better word for important"],
  },
  {
    id: "important",
    text: "better word for important",
    mode: "word",
    match: ["important", "importance", "essential"],
    understoodAs: "Alternatives to “important” — for academic writing",
    results: ["significant", "crucial", "fundamental", "considerable"],
    guide: {
      title: "Which one fits?",
      rows: [
        { term: "significant", when: "a measurable or noticeable effect" },
        { term: "crucial", when: "an outcome depends on it" },
        { term: "fundamental", when: "basic or foundational" },
        { term: "considerable", when: "large in size or amount" },
      ],
      note: "Not interchangeable: “a crucial increase” and “a fundamental amount” both sound wrong.",
    },
    related: ["I want to say something increased significantly", "phrase for giving an example"],
  },
  {
    id: "increase",
    text: "I want to say something increased significantly",
    mode: "collocation",
    match: [
      "increase",
      "increased",
      "increasing",
      "rise",
      "rose",
      "grew",
      "growth",
      "significantly",
    ],
    understoodAs: "Describing a large increase — Task 1 data",
    results: ["rise-sharply", "significant", "considerable"],
    guide: {
      title: "Which one fits?",
      rows: [
        { term: "rise sharply", when: "fast and large (verb + adverb)" },
        { term: "a significant increase", when: "large and noticeable (noun phrase)" },
        { term: "a considerable increase", when: "stressing the size of the change" },
      ],
    },
    related: ["better word for important"],
  },
  {
    id: "serious-problem",
    text: "phrase for causing a serious problem",
    mode: "phrase",
    match: ["problem", "problems", "threat", "harm", "harmful", "damage", "danger", "detrimental"],
    understoodAs: "Ways to say something causes a serious problem",
    results: ["pose-a-threat", "have-a-detrimental-effect-on", "give-rise-to"],
    guide: {
      title: "Which one fits?",
      rows: [
        { term: "pose a threat to", when: "a danger that could cause harm in the future" },
        { term: "have a detrimental effect on", when: "harm that is already happening" },
        { term: "give rise to", when: "one thing causes a new problem or situation" },
      ],
      note: "All three are formal. In Speaking, “is bad for” or “leads to” sound more natural.",
    },
    related: ["better word for important", "I want to express contrast"],
  },
  {
    id: "context",
    text: "Governments should ___ more money to public transport",
    mode: "context",
    match: ["governments", "___", "money", "allocate", "invest"],
    understoodAs: "Find the verb that fits this sentence",
    results: [],
    related: ["better word for important"],
  },
];

/** The six example searches shown first (Finder, Explore and the landing page). */
export const FEATURED_QUERY_IDS = [
  "important",
  "responsible",
  "however",
  "contrast",
  "furthermore",
  "serious-problem",
];

/** The signature context demo: each verb brings its own preposition. */
export const CONTEXT_SENTENCE: {
  parts: GapPart[];
  options: { id: string; fills: [string, string]; fit: Fit; note: string; slug?: string }[];
} = {
  parts: ["Governments should ", { gap: 0 }, " more money ", { gap: 1 }, " public transport."],
  options: [
    {
      id: "allocate",
      fills: ["allocate", "to"],
      fit: "best",
      note: "Formal and precise — the usual verb for deciding how public money is divided.",
      slug: "allocate",
    },
    {
      id: "invest",
      fills: ["invest", "in"],
      fit: "natural",
      note: "Natural when you stress future benefit or development. Notice the change to “in”.",
      slug: "invest",
    },
    {
      id: "devote",
      fills: ["devote", "to"],
      fit: "possible",
      note: "Usually takes time, effort, attention or resources — “devote more resources to” sounds better than “money”.",
      slug: "devote",
    },
    {
      id: "distribute",
      fills: ["distribute", "to"],
      fit: "different",
      note: "Means sharing something out among people or places, not deciding a budget.",
    },
  ],
};
