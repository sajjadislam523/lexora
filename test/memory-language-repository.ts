/**
 * An in-memory LanguageSearchRepository over the rows the importer would write, so search logic
 * is unit-tested without PostgreSQL. It mirrors the database repository's visibility rules
 * (published only) and uses pg_trgm-style similarity for typo candidates.
 * Test infrastructure only; the golden suite runs against the real database repository.
 */
import type { FramePart, SenseSummary } from "@/language/model";
import { toGapFrame } from "@/language/search/match";
import type {
  CollocationHit,
  FormMatch,
  GapFrame,
  IntentDefinition,
  LanguageSearchRepository,
  MistakeHit,
  PatternHit,
  RelationHit,
  SenseRef,
} from "@/language/search/repository";
import { trigramSimilarity } from "@/language/search/text";
import type { DiscourseFunction, ItemKind, RelationType } from "@/language/schema/vocabulary";
import type { ContentRows } from "@/server/content/build";

/** pg_trgm's default similarity threshold, as used by the `%` operator. */
const SIMILARITY = 0.3;

export class MemoryLanguageRepository implements LanguageSearchRepository {
  constructor(private readonly rows: ContentRows) {}

  private get items() {
    return this.rows.items.filter((item) => item.status === "published");
  }

  private isLiveSense(id: string) {
    const sense = this.rows.senses.find((s) => s.id === id);
    if (!sense || sense.status === "retired") return false;
    return this.items.some((item) => item.id === sense.itemId);
  }

  async getSenseSummaries(ids: readonly string[]): Promise<SenseSummary[]> {
    return ids.flatMap((id) => {
      if (!this.isLiveSense(id)) return [];
      const sense = this.rows.senses.find((s) => s.id === id)!;
      const item = this.items.find((i) => i.id === sense.itemId)!;
      const example = this.rows.examples
        .filter((e) => e.senseId === id)
        .sort((a, b) => a.position - b.position)[0];
      const pattern = this.rows.prepositionPatterns.find((p) => p.senseId === id);
      return [
        {
          senseId: id,
          slug: item.slug,
          headword: item.headword,
          kind: item.kind,
          ...(sense.label && { senseLabel: sense.label }),
          definition: sense.definition,
          bestWhen: sense.bestWhen,
          registers: sense.registers,
          skills: sense.skills,
          ...(sense.strength && { strength: sense.strength as 1 | 2 | 3 }),
          ieltsRelevance: sense.ieltsRelevance,
          ...(example && { example: { text: example.text, highlights: example.highlights } }),
          collocations: this.rows.collocations
            .filter((c) => c.senseId === id)
            .slice(0, 4)
            .map((c) => c.phrase),
          ...(pattern && { pattern: pattern.pattern }),
        },
      ];
    });
  }

  async findForms(normalised: string) {
    return this.findFormsIn([normalised]);
  }

  async findFormsIn(phrases: readonly string[]): Promise<FormMatch[]> {
    return this.rows.forms
      .filter((form) => phrases.includes(form.normalized))
      .flatMap((form) => {
        const item = this.items.find((i) => i.id === form.itemId);
        if (!item) return [];
        return [
          {
            itemId: item.id,
            slug: item.slug,
            headword: item.headword,
            kind: item.kind,
            form: form.normalized,
            formType: form.formType,
            ...(form.region && { region: form.region }),
            isDefault: Boolean(form.isDefault),
          },
        ];
      })
      .sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.itemId.localeCompare(b.itemId),
      );
  }

  async findTermCandidates(normalised: string) {
    const terms = [
      ...this.rows.forms
        .filter((f) => this.items.some((i) => i.id === f.itemId))
        .map((f) => f.normalized),
      ...this.rows.collocations.filter((c) => this.isLiveSense(c.senseId)).map((c) => c.normalized),
      ...this.liveBases(),
    ];
    return similar(terms, normalised);
  }

  async findPatternBaseCandidates(normalised: string) {
    return similar(this.liveBases(), normalised);
  }

  private liveBases() {
    return this.rows.prepositionPatterns
      .filter((p) => this.isLiveSense(p.senseId))
      .map((p) => p.baseNormalized);
  }

  async findPatternsByBase(normalised: string) {
    return this.patterns((p) => p.baseNormalized === normalised);
  }

  async patternsOf(senseIds: readonly string[]) {
    return this.patterns((p) => senseIds.includes(p.senseId));
  }

  private patterns(
    test: (row: ContentRows["prepositionPatterns"][number]) => boolean,
  ): PatternHit[] {
    return this.rows.prepositionPatterns
      .filter((p) => test(p) && this.isLiveSense(p.senseId))
      .map((p) => ({
        id: p.id,
        senseId: p.senseId,
        base: p.base,
        preposition: p.preposition,
        pattern: p.pattern,
        complement: p.complement,
        ...(p.note && { note: p.note }),
        ...(p.mistakeId && { mistakeId: p.mistakeId }),
        position: p.position,
      }));
  }

  async findCollocationsByPhrase(normalised: string) {
    return this.collocations((c) => c.normalized === normalised);
  }

  async collocationsOf(senseIds: readonly string[]) {
    return this.collocations((c) => senseIds.includes(c.senseId));
  }

  private collocations(
    test: (row: ContentRows["collocations"][number]) => boolean,
  ): CollocationHit[] {
    return this.rows.collocations
      .filter((c) => test(c) && this.isLiveSense(c.senseId))
      .map((c) => {
        const example = this.rows.examples.find((e) => e.collocationId === c.id);
        const linked = c.itemId
          ? this.rows.senses.find((s) => s.itemId === c.itemId && this.isLiveSense(s.id))
          : undefined;
        return {
          id: c.id,
          senseId: c.senseId,
          phrase: c.phrase,
          ...(c.pattern && { pattern: c.pattern }),
          ...(c.note && { note: c.note }),
          ...(linked && { linkedSenseId: linked.id }),
          ...(example && { example: { text: example.text, highlights: example.highlights } }),
          position: c.position,
        };
      });
  }

  async findMistakes(normalised: string) {
    return this.mistakes(
      (m) =>
        m.wrongNormalized === normalised ||
        (normalised.includes(" ") && ` ${m.wrongNormalized} `.includes(` ${normalised} `)),
    );
  }

  async mistakesOf(senseIds: readonly string[]) {
    return this.mistakes((m) => senseIds.includes(m.senseId));
  }

  private mistakes(test: (row: ContentRows["mistakes"][number]) => boolean): MistakeHit[] {
    return this.rows.mistakes
      .filter((m) => test(m) && this.isLiveSense(m.senseId))
      .map((m) => ({
        id: m.id,
        senseId: m.senseId,
        wrong: m.wrong,
        right: m.right,
        explanation: m.explanation,
        type: m.type,
      }));
  }

  async sensesOfItems(itemIds: readonly string[]): Promise<SenseRef[]> {
    return this.rows.senses
      .filter((s) => itemIds.includes(s.itemId) && this.isLiveSense(s.id))
      .map((s) => ({
        id: s.id,
        itemId: s.itemId,
        position: s.position,
        ...(s.label && { label: s.label }),
        standalone: Boolean(s.standaloneReason),
      }));
  }

  async relationsFrom(
    senseIds: readonly string[],
    types: readonly RelationType[],
  ): Promise<RelationHit[]> {
    return this.rows.relations
      .filter(
        (r) =>
          senseIds.includes(r.fromSenseId) &&
          types.includes(r.type) &&
          this.isLiveSense(r.toSenseId),
      )
      .map((r) => ({
        fromSenseId: r.fromSenseId,
        toSenseId: r.toSenseId,
        type: r.type,
        ...(r.note && { note: r.note }),
        ...(r.contextNote && { contextNote: r.contextNote }),
        weight: r.weight,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  async listIntents(): Promise<IntentDefinition[]> {
    return [...this.rows.intents]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((intent) => ({
        id: intent.id,
        label: intent.label,
        ...(intent.function && { function: intent.function }),
        triggers: this.rows.intentTriggers
          .filter((t) => t.intentId === intent.id)
          .map((t) => t.normalized),
        entries: this.rows.intentEntries
          .filter((e) => e.intentId === intent.id && this.isLiveSense(e.senseId))
          .sort((a, b) => a.position - b.position)
          .map((e) => ({ senseId: e.senseId, group: e.groupLabel, fit: e.fitNote })),
      }));
  }

  async sensesWithFunction(fn: DiscourseFunction, kinds?: readonly ItemKind[]) {
    return this.rows.senses
      .filter((s) => this.isLiveSense(s.id) && (s.functions ?? []).includes(fn))
      .filter(
        (s) => !kinds?.length || kinds.includes(this.items.find((i) => i.id === s.itemId)!.kind),
      )
      .map((s) => s.id);
  }

  async listGapFrames(): Promise<GapFrame[]> {
    return this.rows.frames
      .filter((f) => this.isLiveSense(f.senseId))
      .flatMap((f) => {
        const gap = toGapFrame(f.senseId, f.display, f.parts as FramePart[]);
        return gap ? [gap] : [];
      });
  }

  async fullText(normalised: string) {
    const words = normalised.split(" ").filter((w) => w.length > 3);
    return this.rows.senses
      .filter((s) => this.isLiveSense(s.id))
      .filter((s) => words.some((w) => `${s.definition} ${s.bestWhen}`.toLowerCase().includes(w)))
      .map((s) => s.id);
  }
}

function similar(terms: string[], normalised: string) {
  return [...new Set(terms)]
    .filter((term) => trigramSimilarity(term, normalised) >= SIMILARITY)
    .sort();
}
