import "server-only";

import { LineCounter, parseDocument, type Document } from "yaml";
import type { z } from "zod";

import { normaliseTerm } from "@/language/normalise";
import {
  intentSchema,
  itemSchema,
  sourcesFileSchema,
  type IntentFile,
  type ItemFile,
  type SenseFile,
  type SourceFile,
} from "@/language/schema/content";
import {
  RELATION_TYPES_NEEDING_NOTE,
  type ItemKind,
  type SourceUse,
} from "@/language/schema/vocabulary";

import type { ContentFile } from "./files";

/**
 * Validates authored content in two stages (content/README.md → Validation):
 *
 * 1. Each file is parsed as YAML and checked against its Zod schema.
 * 2. Integrity rules run across all files: references resolve, IDs are unique, highlights occur
 *    in their text, relations aren't duplicated, and the automated quality checklist passes.
 *
 * Every issue names the file, line and field, e.g.
 * `items/significant.yaml:41 senses[0].relations[2].to: unknown sense "considerable.size"`.
 * Pure: no database and no file system, so it runs in CI and in unit tests alike.
 */

export type ContentIssue = { file: string; line?: number; path: string; message: string };

export type ValidatedContent = {
  sources: SourceFile[];
  items: ItemFile[];
  intents: IntentFile[];
};

export type ValidationResult =
  { ok: true; content: ValidatedContent; issues: [] } | { ok: false; issues: ContentIssue[] };

type Path = (string | number)[];

/** Definitions longer than this are rewritten, not trimmed (quality checklist). */
export const MAX_DEFINITION_WORDS = 25;
export const MIN_EXAMPLES_PER_SENSE = 2;

/** Kinds whose senses must relate to other language; patterns are valuable on their own. */
const KINDS_NEEDING_RELATIONS = new Set<ItemKind>([
  "word",
  "phrase",
  "collocation",
  "linker",
  "functional_expression",
]);

export function formatIssue(issue: ContentIssue) {
  const where = issue.line ? `${issue.file}:${issue.line}` : issue.file;
  return issue.path ? `${where} ${issue.path}: ${issue.message}` : `${where}: ${issue.message}`;
}

function formatPath(path: Path) {
  return path
    .map((part, index) =>
      typeof part === "number" ? `[${part}]` : index === 0 ? part : `.${part}`,
    )
    .join("");
}

/** A parsed file plus what's needed to point issues at a line. */
class SourceMap {
  constructor(
    readonly file: string,
    private readonly document: Document,
    private readonly lines: LineCounter,
  ) {}

  /** The line of the deepest node on `path` that exists. */
  lineOf(path: Path): number | undefined {
    for (let depth = path.length; depth >= 0; depth--) {
      const node = this.document.getIn(path.slice(0, depth), true) as
        { range?: [number, number, number] } | undefined;
      if (node?.range) return this.lines.linePos(node.range[0]).line;
    }
    return undefined;
  }
}

class Issues {
  readonly list: ContentIssue[] = [];

  add(map: SourceMap, path: Path, message: string) {
    this.list.push({ file: map.file, line: map.lineOf(path), path: formatPath(path), message });
  }
}

export function validateContent(files: readonly ContentFile[]): ValidationResult {
  const issues = new Issues();
  const sources: { data: SourceFile[]; map: SourceMap }[] = [];
  const items: { data: ItemFile; map: SourceMap }[] = [];
  const intents: { data: IntentFile; map: SourceMap }[] = [];

  // Stage 1: YAML syntax and per-file schema.
  for (const file of files) {
    const lines = new LineCounter();
    const document = parseDocument(file.source, { lineCounter: lines, prettyErrors: false });
    const map = new SourceMap(file.path, document, lines);
    if (document.errors.length > 0) {
      for (const error of document.errors) {
        issues.list.push({
          file: file.path,
          line: lines.linePos(error.pos[0]).line,
          path: "",
          message: `invalid YAML: ${error.message.split("\n")[0]}`,
        });
      }
      continue;
    }

    const folder = file.path.split("/")[0];
    const schema = schemaFor(file.path);
    if (!schema) {
      issues.add(map, [], "unexpected file: content is sources.yaml, items/ and intents/");
      continue;
    }

    const parsed = schema.safeParse(document.toJS());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.add(map, issue.path as Path, issue.message);
      }
      continue;
    }

    if (file.path === "sources.yaml") {
      sources.push({ data: parsed.data as SourceFile[], map });
    } else {
      const data = parsed.data as ItemFile | IntentFile;
      const expected = file.path.slice(folder!.length + 1, -".yaml".length);
      if (data.id !== expected) {
        issues.add(map, ["id"], `must match the file name: "${expected}"`);
      }
      if (folder === "items") items.push({ data: data as ItemFile, map });
      else intents.push({ data: data as IntentFile, map });
    }
  }

  if (sources.length === 0 && !files.some((file) => file.path === "sources.yaml")) {
    issues.list.push({
      file: "sources.yaml",
      path: "",
      message: "missing: every item needs a source",
    });
  }

  // Stage 2 runs only when every file passed stage 1, so its messages are never knock-on errors
  // (a reference to an item whose file didn't parse would otherwise look unknown).
  if (issues.list.length > 0) return { ok: false, issues: sortIssues(issues.list) };

  checkIntegrity(
    {
      sources: sources.flatMap((entry) =>
        entry.data.map((data, index) => ({ data, map: entry.map, index })),
      ),
      items,
      intents,
    },
    issues,
  );

  if (issues.list.length > 0) {
    return { ok: false, issues: sortIssues(issues.list) };
  }
  return {
    ok: true,
    issues: [],
    content: {
      sources: sources.flatMap((entry) => entry.data),
      items: items.map((entry) => entry.data).sort(byId),
      intents: intents.map((entry) => entry.data).sort(byId),
    },
  };
}

function byId(a: { id: string }, b: { id: string }) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function schemaFor(path: string): z.ZodType | undefined {
  if (path === "sources.yaml") return sourcesFileSchema;
  if (/^items\/[^/]+\.yaml$/.test(path)) return itemSchema;
  if (/^intents\/[^/]+\.yaml$/.test(path)) return intentSchema;
  return undefined;
}

function sortIssues(list: ContentIssue[]) {
  return list.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.path.localeCompare(b.path),
  );
}

// ── Integrity rules ────────────────────────────────────────────────────────────────────────

type Entry<T> = { data: T; map: SourceMap };

function checkIntegrity(
  content: {
    sources: (Entry<SourceFile> & { index: number })[];
    items: Entry<ItemFile>[];
    intents: Entry<IntentFile>[];
  },
  issues: Issues,
) {
  const sources = new Map<string, SourceFile>();
  for (const { data, map, index } of content.sources) {
    if (sources.has(data.id)) issues.add(map, [index, "id"], `duplicate source "${data.id}"`);
    sources.set(data.id, data);
    if (data.kind !== "editorial" && !data.verified_on) {
      issues.add(map, [index, "verified_on"], "required: record when the licence was checked");
    }
  }

  const items = new Map(content.items.map((entry) => [entry.data.id, entry]));
  const sensesById = new Map<string, { item: ItemFile; sense: SenseFile }>();
  for (const { data: item } of content.items) {
    for (const sense of item.senses) sensesById.set(`${item.id}.${sense.key}`, { item, sense });
  }

  const usSpellings = content.items.flatMap(({ data }) =>
    data.forms.filter((form) => form.region === "us").map((form) => normaliseTerm(form.form)),
  );

  checkSlugs(content.items, issues);

  // Every authored relation, for duplicate detection and the "has a relation" rule.
  const relationPairs = new Map<string, string>();
  const related = new Set<string>();

  for (const { data: item, map } of content.items) {
    const published = item.status === "published";
    const itemSource = sources.get(item.source);
    const needSource = (use: SourceUse, path: Path, sourceId = item.source) => {
      const source = sources.get(sourceId);
      if (source && !source.permitted_uses.includes(use)) {
        issues.add(map, path, `source "${sourceId}" doesn't permit ${use}`);
      }
    };

    if (!itemSource) issues.add(map, ["source"], `unknown source "${item.source}"`);
    for (const [index, id] of (item.informed_by ?? []).entries()) {
      const source = sources.get(id);
      if (!source) issues.add(map, ["informed_by", index], `unknown source "${id}"`);
      else if (!source.permitted_uses.some((use) => use === "frequency" || use === "candidates")) {
        issues.add(
          map,
          ["informed_by", index],
          `source "${id}" permits neither frequency nor candidates`,
        );
      }
    }

    // Review and lifecycle.
    if (published && (!item.review.reviewer || !item.review.on)) {
      issues.add(map, ["review"], "published items need a reviewer and a review date");
    }
    if (item.replaced_by !== undefined) {
      if (item.status !== "retired") {
        issues.add(map, ["replaced_by"], "only retired items have a replacement");
      } else {
        const replacement = items.get(item.replaced_by)?.data;
        if (!replacement) issues.add(map, ["replaced_by"], `unknown item "${item.replaced_by}"`);
        else if (replacement.status !== "published") {
          issues.add(map, ["replaced_by"], `"${item.replaced_by}" is not published`);
        }
      }
    }

    // Forms: one default, British or neutral; at least one lemma; no duplicates.
    const flagged = item.forms.filter((form) => form.default);
    if (flagged.length > 1) issues.add(map, ["forms"], "only one form can be the default");
    if (!item.forms.some((form) => form.type === "lemma")) {
      issues.add(map, ["forms"], "needs a lemma form");
    }
    const defaultForm = flagged[0] ?? item.forms.find((form) => form.type === "lemma");
    if (defaultForm?.region === "us") {
      issues.add(map, ["forms"], "the default form must be British or neutral, not US");
    }
    const seenForms = new Set<string>();
    for (const [index, form] of item.forms.entries()) {
      const normalised = normaliseTerm(form.form);
      if (seenForms.has(normalised))
        issues.add(map, ["forms", index, "form"], `duplicate form "${form.form}"`);
      seenForms.add(normalised);
    }

    // Senses.
    const senseKeys = new Set<string>();
    if (published && !item.senses.some((sense) => !sense.retired)) {
      issues.add(map, ["senses"], "a published item needs at least one sense that isn't retired");
    }

    for (const [s, sense] of item.senses.entries()) {
      const at = (...path: Path): Path => ["senses", s, ...path];
      const senseId = `${item.id}.${sense.key}`;
      const live = published && !sense.retired;
      if (senseKeys.has(sense.key))
        issues.add(map, at("key"), `duplicate sense key "${sense.key}"`);
      senseKeys.add(sense.key);

      if (sense.replaced_by !== undefined) {
        const target = sensesById.get(sense.replaced_by);
        if (!sense.retired)
          issues.add(map, at("replaced_by"), "only retired senses have a replacement");
        else if (!target)
          issues.add(map, at("replaced_by"), `unknown sense "${sense.replaced_by}"`);
        else if (target.sense.retired || target.item.status !== "published") {
          issues.add(map, at("replaced_by"), `"${sense.replaced_by}" is not published`);
        }
      }

      // Definition: short and not circular.
      const definitionWords = sense.definition.split(/\s+/).length;
      if (definitionWords > MAX_DEFINITION_WORDS) {
        issues.add(
          map,
          at("definition"),
          `${definitionWords} words; keep it to ${MAX_DEFINITION_WORDS} or fewer`,
        );
      }
      if (containsPhrase(normaliseTerm(sense.definition), normaliseTerm(item.headword))) {
        issues.add(map, at("definition"), `mustn't contain the headword "${item.headword}"`);
      }

      // Kind-specific requirements.
      if (sense.linker && item.kind !== "linker") {
        issues.add(map, at("linker"), "only linkers have linker details");
      }
      if (live && item.kind === "linker" && !sense.linker) {
        issues.add(map, at("linker"), "linkers need connects, positions and punctuation");
      }
      if (live && item.kind === "preposition_pattern" && sense.preposition_patterns.length === 0) {
        issues.add(
          map,
          at("preposition_patterns"),
          "a preposition pattern item needs at least one pattern",
        );
      }
      if (live && item.kind === "sentence_pattern" && sense.frames.length === 0) {
        issues.add(map, at("frames"), "a sentence pattern item needs at least one frame");
      }

      // Local child IDs are unique across the sense (`<sense>:<id>` is their global ID).
      const childIds = new Map<string, string>();
      const claim = (kind: string, id: string, path: Path) => {
        const previous = childIds.get(id);
        if (previous)
          issues.add(map, path, `ID "${id}" is already used by a ${previous} in this sense`);
        childIds.set(id, kind);
      };
      sense.examples.forEach((example, i) => claim("example", example.id, at("examples", i, "id")));
      sense.collocations.forEach((row, i) =>
        claim("collocation", row.id, at("collocations", i, "id")),
      );
      sense.preposition_patterns.forEach((row, i) =>
        claim("preposition pattern", row.id, at("preposition_patterns", i, "id")),
      );
      sense.frames.forEach((row, i) => claim("frame", row.id, at("frames", i, "id")));
      sense.mistakes.forEach((row, i) => claim("mistake", row.id, at("mistakes", i, "id")));

      // Examples.
      if (live && sense.examples.length < MIN_EXAMPLES_PER_SENSE) {
        issues.add(map, at("examples"), `needs at least ${MIN_EXAMPLES_PER_SENSE} examples`);
      }
      if (
        live &&
        sense.skills.includes("speaking") &&
        !sense.examples.some((e) => e.skill === "speaking")
      ) {
        issues.add(map, at("examples"), "is used in speaking, so it needs a speaking example");
      }
      for (const [e, example] of sense.examples.entries()) {
        const highlights = Array.isArray(example.highlight)
          ? example.highlight
          : [example.highlight];
        for (const [h, highlight] of highlights.entries()) {
          if (!example.text.toLowerCase().includes(highlight.toLowerCase())) {
            const path = Array.isArray(example.highlight)
              ? at("examples", e, "highlight", h)
              : at("examples", e, "highlight");
            issues.add(map, path, `"${highlight}" doesn't occur in the example text`);
          }
        }
        if (example.collocation && !sense.collocations.some((c) => c.id === example.collocation)) {
          issues.add(
            map,
            at("examples", e, "collocation"),
            `no collocation "${example.collocation}" in this sense`,
          );
        }
        if (example.pattern && !sense.preposition_patterns.some((p) => p.id === example.pattern)) {
          issues.add(
            map,
            at("examples", e, "pattern"),
            `no preposition pattern "${example.pattern}" in this sense`,
          );
        }
        if (example.source) {
          if (!sources.has(example.source)) {
            issues.add(map, at("examples", e, "source"), `unknown source "${example.source}"`);
          } else needSource("examples", at("examples", e, "source"), example.source);
        } else {
          needSource("examples", at("examples", e));
        }
      }

      // Collocations.
      for (const [c, collocation] of sense.collocations.entries()) {
        if (collocation.item && !items.has(collocation.item)) {
          issues.add(map, at("collocations", c, "item"), `unknown item "${collocation.item}"`);
        }
      }

      // Preposition patterns contain their base and preposition.
      for (const [p, row] of sense.preposition_patterns.entries()) {
        const pattern = normaliseTerm(row.pattern);
        if (!containsPhrase(pattern, normaliseTerm(row.base))) {
          issues.add(
            map,
            at("preposition_patterns", p, "pattern"),
            `must contain the base "${row.base}"`,
          );
        }
        if (!containsPhrase(pattern, normaliseTerm(row.preposition))) {
          issues.add(
            map,
            at("preposition_patterns", p, "pattern"),
            `must contain the preposition "${row.preposition}"`,
          );
        }
        if (row.mistake && !sense.mistakes.some((m) => m.id === row.mistake)) {
          issues.add(
            map,
            at("preposition_patterns", p, "mistake"),
            `no mistake "${row.mistake}" in this sense`,
          );
        }
      }

      // Frames: at least one literal part, at most one head.
      for (const [f, frame] of sense.frames.entries()) {
        const literal = frame.parts.filter((part) => "text" in part);
        if (literal.length === 0)
          issues.add(map, at("frames", f, "parts"), "needs at least one text part");
        if (literal.filter((part) => "head" in part && part.head).length > 1) {
          issues.add(map, at("frames", f, "parts"), "only one part can be the head");
        }
      }

      // Mistakes: wrong and right differ; American spelling is never a mistake.
      if (sense.mistakes.length > 0) needSource("mistakes", at("mistakes"));
      for (const [m, mistake] of sense.mistakes.entries()) {
        const wrong = normaliseTerm(mistake.wrong);
        if (wrong === normaliseTerm(mistake.right)) {
          issues.add(map, at("mistakes", m, "right"), "is the same as the wrong form");
        }
        const spelling = usSpellings.find((form) => containsPhrase(wrong, form));
        if (spelling) {
          issues.add(
            map,
            at("mistakes", m, "wrong"),
            `contains the US spelling "${spelling}", which is not a mistake`,
          );
        }
      }

      // Relations: targets exist, notes where required, no self or duplicate relations.
      if (sense.relations.length > 0) needSource("relations", at("relations"));
      for (const [r, relation] of sense.relations.entries()) {
        const path = at("relations", r);
        const target = sensesById.get(relation.to);
        related.add(senseId);
        if (relation.to === senseId) {
          issues.add(map, [...path, "to"], "a sense can't relate to itself");
          continue;
        }
        if (!target) {
          issues.add(map, [...path, "to"], `unknown sense "${relation.to}"`);
          continue;
        }
        if (live && (target.item.status !== "published" || target.sense.retired)) {
          issues.add(map, [...path, "to"], `"${relation.to}" is not published`);
        }
        if (RELATION_TYPES_NEEDING_NOTE.has(relation.type) && !relation.note) {
          issues.add(
            map,
            [...path, "note"],
            `required for ${relation.type} relations: explain the difference`,
          );
        }
        const pair = [senseId, relation.to].sort().join(" ↔ ");
        const key = `${relation.type}:${pair}`;
        const previous = relationPairs.get(key);
        if (previous) {
          issues.add(
            map,
            path,
            `${relation.type} relation ${pair} is already declared in ${previous}`,
          );
        }
        relationPairs.set(key, `${map.file}:${map.lineOf(path) ?? "?"}`);
        related.add(relation.to);
      }

      // Provenance of the prose fields.
      needSource("definitions", at("definition"));
      needSource("notes", at("best_when"));
    }
  }

  // Every published sense of a relational kind relates to something, unless it says why not.
  for (const { data: item, map } of content.items) {
    if (item.status !== "published" || !KINDS_NEEDING_RELATIONS.has(item.kind)) continue;
    for (const [s, sense] of item.senses.entries()) {
      const senseId = `${item.id}.${sense.key}`;
      if (sense.retired || sense.standalone || related.has(senseId)) continue;
      issues.add(
        map,
        ["senses", s],
        "needs at least one relation, or `standalone` with the reason",
      );
    }
  }

  checkIntents(content.intents, sensesById, issues);
}

function checkSlugs(items: Entry<ItemFile>[], issues: Issues) {
  const owners = new Map<string, string>();
  for (const { data: item, map } of items) {
    const slug = item.slug ?? item.id;
    const claim = (value: string, path: Path) => {
      const owner = owners.get(value);
      if (owner && owner !== item.id)
        issues.add(map, path, `slug "${value}" is already used by "${owner}"`);
      else if (owner === item.id) issues.add(map, path, `slug "${value}" is listed twice`);
      owners.set(value, item.id);
    };
    claim(slug, item.slug ? ["slug"] : ["id"]);
    for (const [index, previous] of (item.previous_slugs ?? []).entries()) {
      claim(previous, ["previous_slugs", index]);
    }
  }
}

function checkIntents(
  intents: Entry<IntentFile>[],
  sensesById: Map<string, { item: ItemFile; sense: SenseFile }>,
  issues: Issues,
) {
  const triggers = new Map<string, string>();
  for (const { data: intent, map } of intents) {
    for (const [t, trigger] of intent.triggers.entries()) {
      const normalised = normaliseTerm(trigger);
      const owner = triggers.get(normalised);
      if (owner) issues.add(map, ["triggers", t], `trigger "${trigger}" also selects "${owner}"`);
      triggers.set(normalised, intent.id);
    }
    const senses = new Set<string>();
    for (const [g, group] of intent.groups.entries()) {
      for (const [e, entry] of group.entries.entries()) {
        const path: Path = ["groups", g, "entries", e, "sense"];
        const target = sensesById.get(entry.sense);
        if (!target) issues.add(map, path, `unknown sense "${entry.sense}"`);
        else if (target.item.status !== "published" || target.sense.retired) {
          issues.add(map, path, `"${entry.sense}" is not published`);
        }
        if (senses.has(entry.sense))
          issues.add(map, path, `"${entry.sense}" is already listed in this intent`);
        senses.add(entry.sense);
      }
    }
  }
}

/** Whole-word containment of normalised text: "responsible for" contains "for", not "or". */
function containsPhrase(haystack: string, needle: string) {
  return needle.length > 0 && ` ${haystack} `.includes(` ${needle} `);
}
