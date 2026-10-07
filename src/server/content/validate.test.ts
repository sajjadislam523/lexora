import { describe, expect, it } from "vitest";

import { fixtureContent, sense, toFiles, type FixtureContent } from "../../../test/content-fixture";

import type { ContentFile } from "./files";
import { formatIssue, validateContent } from "./validate";

function messages(files: ContentFile[]) {
  const result = validateContent(files);
  return result.ok ? [] : result.issues.map(formatIssue);
}

/** Breaks the fixture with `mutate` and returns the issues it causes. */
function issuesAfter(mutate: (content: FixtureContent) => void) {
  const content = fixtureContent();
  mutate(content);
  return messages(toFiles(content));
}

describe("validateContent", () => {
  it("accepts the valid fixture", () => {
    const result = validateContent(toFiles(fixtureContent()));
    expect(result.issues).toEqual([]);
    expect(result.ok && result.content.items.map((item) => item.id)).toEqual([
      "analyse",
      "crucial",
      "however",
      "important",
    ]);
  });

  describe("stage 1: YAML and schema", () => {
    it("reports YAML syntax errors with their line", () => {
      const files = toFiles(fixtureContent());
      files.push({ path: "items/broken.yaml", source: "id: broken\nkind: [word\n" });
      expect(messages(files)).toEqual([
        expect.stringMatching(/^items\/broken\.yaml:\d+: invalid YAML/),
      ]);
    });

    it("names the file, line and field of a schema error", () => {
      const files = toFiles(fixtureContent());
      const file = files.find((f) => f.path === "items/crucial.yaml")!;
      file.source = file.source.replace("cefr: B2", "cefr: Z9");
      const line = file.source.split("\n").findIndex((l) => l.includes("cefr: Z9")) + 1;
      expect(messages(files)).toEqual([
        expect.stringContaining(`items/crucial.yaml:${line} senses[0].cefr:`),
      ]);
    });

    it("rejects misspelt fields instead of ignoring them", () => {
      const issues = issuesAfter((c) => {
        sense(c, "crucial").best_whenn = "typo";
      });
      expect(issues).toEqual([
        expect.stringMatching(/crucial\.yaml:\d+ senses\[0\]: .*best_whenn/),
      ]);
    });

    it("requires item IDs to match the file name", () => {
      const issues = issuesAfter((c) => {
        c.items.crucial!.id = "critical";
      });
      expect(issues).toContainEqual(
        expect.stringMatching(/crucial\.yaml:\d+ id: must match the file name/),
      );
    });

    it("rejects IDs that aren't kebab-case", () => {
      const issues = issuesAfter((c) => {
        sense(c, "crucial").key = "Essential";
      });
      expect(issues).toEqual([
        expect.stringContaining("senses[0].key: must be lower-case kebab-case"),
      ]);
    });

    it("reports a missing sources file", () => {
      const files = toFiles(fixtureContent()).filter((f) => f.path !== "sources.yaml");
      expect(messages(files)).toContainEqual("sources.yaml: missing: every item needs a source");
    });
  });

  describe("stage 2: integrity", () => {
    it("points an unknown relation target at its line", () => {
      const content = fixtureContent();
      (sense(content, "important").relations as { to: string }[])[0]!.to = "considerable.size";
      const files = toFiles(content);
      const source = files.find((f) => f.path === "items/important.yaml")!.source;
      const line = source.split("\n").findIndex((l) => l.includes("considerable.size")) + 1;
      expect(messages(files)).toContainEqual(
        `items/important.yaml:${line} senses[0].relations[0].to: unknown sense "considerable.size"`,
      );
    });

    it.each([
      [
        "a relation note is missing",
        (c: FixtureContent) => {
          delete (sense(c, "important").relations as Record<string, unknown>[])[0]!.note;
        },
        "relations[0].note: required for stronger relations",
      ],
      [
        "a relation is declared on both sides",
        (c: FixtureContent) => {
          sense(c, "crucial").relations = [
            { type: "stronger", to: "important.main", note: "Contradicts the other side." },
          ];
        },
        "stronger relation crucial.essential ↔ important.main is already declared",
      ],
      [
        "a sense relates to itself",
        (c: FixtureContent) => {
          sense(c, "crucial").relations = [{ type: "related", to: "crucial.essential" }];
        },
        "a sense can't relate to itself",
      ],
      [
        "a published item relates to a draft",
        (c: FixtureContent) => {
          c.items.crucial!.status = "draft";
        },
        '"crucial.essential" is not published',
      ],
      [
        "a definition is too long",
        (c: FixtureContent) => {
          sense(c, "crucial").definition = Array(26).fill("word").join(" ");
        },
        "definition: 26 words; keep it to 25 or fewer",
      ],
      [
        "a definition uses its headword",
        (c: FixtureContent) => {
          sense(c, "crucial").definition = "Crucial means very important.";
        },
        'definition: mustn\'t contain the headword "crucial"',
      ],
      [
        "a sense has fewer than two examples",
        (c: FixtureContent) => {
          sense(c, "crucial").examples = [(sense(c, "crucial").examples as unknown[])[0]];
        },
        "examples: needs at least 2 examples",
      ],
      [
        "a speaking sense has no speaking example",
        (c: FixtureContent) => {
          (sense(c, "important").examples as Record<string, unknown>[])[1]!.skill = "writing";
        },
        "is used in speaking, so it needs a speaking example",
      ],
      [
        "a highlight isn't in its example",
        (c: FixtureContent) => {
          (sense(c, "crucial").examples as Record<string, unknown>[])[0]!.highlight = "vital";
        },
        'examples[0].highlight: "vital" doesn\'t occur in the example text',
      ],
      [
        "an example points at a missing collocation",
        (c: FixtureContent) => {
          (sense(c, "crucial").examples as Record<string, unknown>[])[1]!.collocation = "factor";
        },
        'examples[1].collocation: no collocation "factor" in this sense',
      ],
      [
        "a preposition pattern lacks its base",
        (c: FixtureContent) => {
          (sense(c, "important").preposition_patterns as Record<string, unknown>[])[0]!.pattern =
            "matters to + person";
        },
        'must contain the base "important"',
      ],
      [
        "a mistake's wrong and right forms are the same",
        (c: FixtureContent) => {
          const mistake = (sense(c, "important").mistakes as Record<string, unknown>[])[0]!;
          mistake.right = mistake.wrong;
        },
        "mistakes[0].right: is the same as the wrong form",
      ],
      [
        "a US spelling is presented as a mistake",
        (c: FixtureContent) => {
          sense(c, "crucial").mistakes = [
            {
              id: "spelling",
              wrong: "We need to analyze it.",
              right: "We need to analyse it.",
              type: "grammar",
              explanation: "Wrong rule.",
            },
          ];
        },
        'contains the US spelling "analyze", which is not a mistake',
      ],
      [
        "two forms are the default",
        (c: FixtureContent) => {
          (c.items.analyse!.forms as Record<string, unknown>[])[1]!.default = true;
        },
        "forms: only one form can be the default",
      ],
      [
        "the default form is American",
        (c: FixtureContent) => {
          c.items.analyse!.forms = [
            { form: "analyze", type: "lemma", region: "us" },
            { form: "analyse", type: "spelling_variant", region: "gb" },
          ];
        },
        "the default form must be British or neutral",
      ],
      [
        "an item names an unknown source",
        (c: FixtureContent) => {
          c.items.crucial!.source = "oxford";
        },
        'source: unknown source "oxford"',
      ],
      [
        "a source doesn't permit the use",
        (c: FixtureContent) => {
          c.sources[0]!.permitted_uses = ["definitions", "examples", "notes", "mistakes"];
        },
        'source "lexora-editorial" doesn\'t permit relations',
      ],
      [
        "an external source has no licence check date",
        (c: FixtureContent) => {
          c.sources.push({
            id: "ngsl",
            name: "New General Service List",
            kind: "open_dataset",
            licence: "CC-BY-4.0",
            permitted_uses: ["frequency"],
          });
        },
        "verified_on: required: record when the licence was checked",
      ],
      [
        "a published item has no reviewer",
        (c: FixtureContent) => {
          c.items.crucial!.review = { author: "claude" };
        },
        "review: published items need a reviewer and a review date",
      ],
      [
        "a live item has a replacement",
        (c: FixtureContent) => {
          c.items.analyse!.replaced_by = "crucial";
        },
        "replaced_by: only retired items have a replacement",
      ],
      [
        "two items share a slug",
        (c: FixtureContent) => {
          c.items.analyse!.previous_slugs = ["crucial"];
        },
        'slug "crucial" is already used by "crucial"',
      ],
      [
        "a word sense has no relations",
        (c: FixtureContent) => {
          delete sense(c, "analyse").standalone;
        },
        "needs at least one relation, or `standalone` with the reason",
      ],
      [
        "a linker has no linker details",
        (c: FixtureContent) => {
          delete sense(c, "however").linker;
        },
        "linkers need connects, positions and punctuation",
      ],
      [
        "a non-linker has linker details",
        (c: FixtureContent) => {
          sense(c, "crucial").linker = sense(c, "however").linker;
        },
        "only linkers have linker details",
      ],
      [
        "two children of a sense share an ID",
        (c: FixtureContent) => {
          (sense(c, "important").mistakes as Record<string, unknown>[])[0]!.id = "to";
          (sense(c, "important").preposition_patterns as Record<string, unknown>[])[0]!.mistake =
            "to";
        },
        'ID "to" is already used by a preposition pattern in this sense',
      ],
      [
        "an intent lists an unknown sense",
        (c: FixtureContent) => {
          (
            c.intents["express-contrast"]!.groups as { entries: { sense: string }[] }[]
          )[0]!.entries[0]!.sense = "whereas.contrast";
        },
        'unknown sense "whereas.contrast"',
      ],
      [
        "two intents share a trigger",
        (c: FixtureContent) => {
          c.intents["concede-a-point"] = {
            ...c.intents["express-contrast"]!,
            id: "concede-a-point",
            triggers: ["Show a difference"],
          };
        },
        'trigger "Show a difference" also selects "express-contrast"',
      ],
    ])("rejects content where %s", (_, mutate, expected) => {
      const issues = issuesAfter(mutate);
      expect(issues).toContainEqual(expect.stringContaining(expected));
    });

    it("relaxes publishing rules for drafts", () => {
      const issues = issuesAfter((c) => {
        const item = c.items.analyse!;
        item.status = "draft";
        item.review = { author: "claude" };
        delete sense(c, "analyse").standalone;
        sense(c, "analyse").examples = [];
      });
      expect(issues).toEqual([]);
    });

    it("keeps a retired sense valid while it has a published replacement", () => {
      const issues = issuesAfter((c) => {
        const senses = c.items.crucial!.senses as Record<string, unknown>[];
        senses.push({ ...senses[0]!, key: "old", retired: true, replaced_by: "crucial.essential" });
      });
      expect(issues).toEqual([]);
    });
  });
});
