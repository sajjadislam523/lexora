/**
 * A small, valid content set for validator and importer tests. Each call returns fresh objects,
 * so a test can break exactly one rule and expect exactly one issue.
 * Test data only: the real dataset lives in content/.
 */
import { stringify } from "yaml";

import type { ContentFile } from "@/server/content/files";

type Data = Record<string, unknown>;

export type FixtureContent = {
  sources: Data[];
  items: Record<string, Data>;
  intents: Record<string, Data>;
};

const review = { author: "claude", reviewer: "owner", on: "2026-10-07", level: "editorial" };

export function fixtureContent(): FixtureContent {
  return {
    sources: [
      {
        id: "lexora-editorial",
        name: "Lexora editorial",
        kind: "editorial",
        licence: "LicenseRef-Lexora-Proprietary",
        permitted_uses: ["definitions", "examples", "relations", "notes", "mistakes"],
      },
    ],
    items: {
      important: {
        id: "important",
        kind: "word",
        headword: "important",
        status: "published",
        source: "lexora-editorial",
        review: { ...review },
        forms: [{ form: "important", type: "lemma" }],
        senses: [
          {
            key: "main",
            pos: "adjective",
            definition: "Having a great effect or value, or worth paying attention to.",
            cefr: "B1",
            registers: ["neutral"],
            skills: ["writing", "speaking"],
            ielts: { relevance: "core", tasks: ["writing-2", "speaking-1"] },
            strength: 1,
            functions: ["importance"],
            best_when: "A safe, general choice.",
            examples: [
              {
                id: "ex1",
                text: "It is important to consider the long-term costs.",
                highlight: "important",
                skill: "writing",
                task: "writing-2",
              },
              {
                id: "ex2",
                text: "My family is really important to me.",
                highlight: "important to me",
                skill: "speaking",
                pattern: "to",
              },
            ],
            preposition_patterns: [
              {
                id: "to",
                base: "important",
                preposition: "to",
                pattern: "important to + person",
                complement: "person",
                mistake: "for-me",
              },
            ],
            mistakes: [
              {
                id: "for-me",
                wrong: "Family is very important for me.",
                right: "Family is very important to me.",
                type: "preposition",
                explanation: 'Use "important to" for what matters to a person.',
              },
            ],
            relations: [
              {
                type: "stronger",
                to: "crucial.essential",
                weight: 3,
                note: "Crucial means an outcome depends on it.",
              },
            ],
          },
        ],
      },
      crucial: {
        id: "crucial",
        kind: "word",
        headword: "crucial",
        status: "published",
        source: "lexora-editorial",
        review: { ...review },
        forms: [{ form: "crucial", type: "lemma" }],
        senses: [
          {
            key: "essential",
            pos: "adjective",
            definition: "Extremely important, because something else depends on it.",
            cefr: "B2",
            registers: ["academic", "neutral"],
            skills: ["writing"],
            ielts: { relevance: "core", tasks: ["writing-2"] },
            strength: 3,
            best_when: "An outcome depends on it.",
            examples: [
              {
                id: "ex1",
                text: "Sleep is crucial to success.",
                highlight: "crucial",
                skill: "writing",
              },
              {
                id: "ex2",
                text: "Investment plays a crucial role in growth.",
                highlight: "crucial role",
                skill: "writing",
                collocation: "role",
              },
            ],
            collocations: [
              {
                id: "role",
                phrase: "play a crucial role",
                pattern: "play a crucial role in + noun",
              },
            ],
          },
        ],
      },
      analyse: {
        id: "analyse",
        kind: "word",
        headword: "analyse",
        status: "published",
        source: "lexora-editorial",
        review: { ...review },
        regional_note: "Both spellings are correct.",
        forms: [
          { form: "analyse", type: "lemma", region: "gb", default: true },
          { form: "analyze", type: "spelling_variant", region: "us" },
        ],
        senses: [
          {
            key: "examine",
            pos: "verb",
            definition: "To examine something in detail to understand it.",
            cefr: "B2",
            registers: ["academic"],
            skills: ["writing"],
            ielts: { relevance: "high", tasks: ["writing-1"] },
            best_when: "Describing how data or problems are studied.",
            standalone: "Fixture item without alternatives.",
            examples: [
              {
                id: "ex1",
                text: "The report analyses sales data.",
                highlight: "analyses",
                skill: "writing",
              },
              {
                id: "ex2",
                text: "We analysed the results.",
                highlight: "analysed",
                skill: "writing",
              },
            ],
          },
        ],
      },
      however: {
        id: "however",
        kind: "linker",
        headword: "however",
        status: "published",
        source: "lexora-editorial",
        review: { ...review },
        forms: [{ form: "however", type: "lemma" }],
        senses: [
          {
            key: "contrast",
            pos: "adverb",
            definition: "Introduces a statement that contrasts with what came before.",
            cefr: "B1",
            registers: ["neutral", "academic"],
            skills: ["writing"],
            ielts: { relevance: "core", tasks: ["writing-2"] },
            functions: ["contrast"],
            best_when: "Any general contrast between two sentences.",
            standalone: "Fixture item without alternatives.",
            linker: {
              connects: "sentences",
              positions: ["start", "middle"],
              punctuation: "Comma after it at the start of a sentence.",
            },
            examples: [
              {
                id: "ex1",
                text: "Prices rose. However, demand fell.",
                highlight: "However",
                skill: "writing",
              },
              {
                id: "ex2",
                text: "It was cheap. It was, however, slow.",
                highlight: "however",
                skill: "writing",
              },
            ],
          },
        ],
      },
    },
    intents: {
      "express-contrast": {
        id: "express-contrast",
        label: "Express contrast",
        function: "contrast",
        triggers: ["express contrast", "show a difference"],
        groups: [
          {
            label: "Between sentences",
            entries: [{ sense: "however.contrast", fit: "general contrast" }],
          },
        ],
      },
    },
  };
}

export function toFiles(content: FixtureContent): ContentFile[] {
  return [
    { path: "sources.yaml", source: stringify(content.sources) },
    ...Object.entries(content.items).map(([id, item]) => ({
      path: `items/${id}.yaml`,
      source: stringify(item),
    })),
    ...Object.entries(content.intents).map(([id, intent]) => ({
      path: `intents/${id}.yaml`,
      source: stringify(intent),
    })),
  ];
}

/** Shorthand for reaching into the fixture's nested data in tests. */
export function sense(content: FixtureContent, itemId: string, index = 0) {
  return (content.items[itemId]!.senses as Data[])[index]!;
}
