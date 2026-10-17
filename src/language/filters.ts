/**
 * Search filters (Phase 4, docs/specs/phase-4-search-depth.md §5): the dimensions, their values,
 * what a match means, and the canonical URL form. Client-safe and shared by the server (search,
 * browse, page routing) and the browser (filter controls), so both read one contract.
 *
 * - Four dimensions: kind (item), function, IELTS use and topic (sense). One value each; they
 *   combine with AND. A filter matches the sense a result saves.
 * - IELTS use joins skill and task: `writing`/`speaking` match the sense's skills, a task
 *   (`writing-2`) matches a sense used in that task, not only in it.
 * - General language (no topics) never matches a topic.
 */
import { z } from "zod";

import {
  DISCOURSE_FUNCTIONS,
  ITEM_KINDS,
  TOPICS,
  type DiscourseFunction,
  type IeltsTask,
  type ItemKind,
  type Skill,
  type Topic,
} from "./schema/vocabulary";

/** "IELTS use": a skill in general, or one task of it. */
export const IELTS_USES = [
  "writing",
  "writing-1",
  "writing-2",
  "speaking",
  "speaking-1",
  "speaking-2",
  "speaking-3",
] as const satisfies readonly (Skill | IeltsTask)[];
export type IeltsUse = (typeof IELTS_USES)[number];

export const searchFiltersSchema = z.strictObject({
  kind: z.enum(ITEM_KINDS).optional(),
  function: z.enum(DISCOURSE_FUNCTIONS).optional(),
  use: z.enum(IELTS_USES).optional(),
  topic: z.enum(TOPICS).optional(),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type FilterDimension = keyof SearchFilters;

/** In URL and display order. */
export const FILTER_DIMENSIONS = ["kind", "function", "use", "topic"] as const;

/** Every value of each dimension, in display order. */
export const FILTER_VALUES = {
  kind: ITEM_KINDS,
  function: DISCOURSE_FUNCTIONS,
  use: IELTS_USES,
  topic: TOPICS,
} as const satisfies { [D in FilterDimension]: readonly NonNullable<SearchFilters[D]>[] };

/** Browse lists this many senses per page. */
export const BROWSE_PAGE_SIZE = 30;

export function hasFilters(filters: SearchFilters | undefined): filters is SearchFilters {
  return FILTER_DIMENSIONS.some((dimension) => filters?.[dimension] !== undefined);
}

/** What a filter is checked against: the metadata of one sense and its item. */
export type FilterFacets = {
  kind: ItemKind;
  functions: readonly DiscourseFunction[];
  topics: readonly Topic[];
  skills: readonly Skill[];
  ieltsTasks: readonly IeltsTask[];
};

export function matchesUse(facets: Pick<FilterFacets, "skills" | "ieltsTasks">, use: IeltsUse) {
  return use === "writing" || use === "speaking"
    ? facets.skills.includes(use)
    : facets.ieltsTasks.includes(use);
}

/** Whether a sense satisfies every selected filter. */
export function matchesFilters(facets: FilterFacets, filters: SearchFilters) {
  return (
    (filters.kind === undefined || facets.kind === filters.kind) &&
    (filters.function === undefined || facets.functions.includes(filters.function)) &&
    (filters.use === undefined || matchesUse(facets, filters.use)) &&
    (filters.topic === undefined || facets.topics.includes(filters.topic))
  );
}

// ── URL form ─────────────────────────────────────────────────────────────────────────────────

/** The canonical parameter order. */
export const FINDER_PARAMS = ["q", "kind", "function", "use", "topic", "page"] as const;

/** Kinds are kebab-case in URLs (`preposition-pattern`), like every other value. */
const toUrlValue = (value: string) => value.replaceAll("_", "-");

const URL_VALUES: { [D in FilterDimension]: Map<string, NonNullable<SearchFilters[D]>> } = {
  kind: new Map(ITEM_KINDS.map((kind) => [toUrlValue(kind), kind])),
  function: new Map(DISCOURSE_FUNCTIONS.map((fn) => [fn, fn])),
  use: new Map(IELTS_USES.map((use) => [use, use])),
  topic: new Map(TOPICS.map((topic) => [topic, topic])),
};

export type FinderState = {
  /** The trimmed query; empty when none. */
  q: string;
  filters: SearchFilters;
  /** Browse page, from 1. Only browse (filters without a query) has pages. */
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const valuesOf = (raw: string | string[] | undefined) =>
  raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

/**
 * Reads the Finder's URL parameters. Unknown parameters, invalid values and repeats are dropped:
 * each dimension takes its first valid value. `page` counts only when browsing.
 */
export function parseFinderParams(params: RawParams): FinderState {
  const q = (valuesOf(params.q)[0] ?? "").trim();
  const filters: SearchFilters = {};
  for (const dimension of FILTER_DIMENSIONS) {
    for (const value of valuesOf(params[dimension])) {
      const known = (URL_VALUES[dimension] as Map<string, string>).get(value);
      if (known !== undefined) {
        (filters as Record<string, string>)[dimension] = known;
        break;
      }
    }
  }
  const pageValue = valuesOf(params.page)[0];
  const page =
    !q && hasFilters(filters) && pageValue && /^[1-9]\d{0,3}$/.test(pageValue)
      ? Number(pageValue)
      : 1;
  return { q, filters, page };
}

/** The canonical URL parameters of a state, in order: `q`, the filters, then `page` above 1. */
export function finderSearchParams(state: FinderState) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  for (const dimension of FILTER_DIMENSIONS) {
    const value = state.filters[dimension];
    if (value !== undefined) params.set(dimension, toUrlValue(value));
  }
  if (!state.q && hasFilters(state.filters) && state.page > 1)
    params.set("page", String(state.page));
  return params;
}

/** The canonical URL of a Finder state on `/explore` or `/finder`. */
export function finderHref(basePath: "/finder" | "/explore", state: FinderState) {
  const query = finderSearchParams(state).toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Whether the parameters are already canonical: the same keys, in the same order, each once,
 * with the same values. Pages redirect anything else to `finderHref` of the parsed state.
 */
export function isCanonicalFinderParams(params: RawParams, state: FinderState) {
  const expected = [...finderSearchParams(state)];
  const actual = Object.entries(params).filter(([, value]) => value !== undefined);
  return (
    actual.length === expected.length &&
    actual.every(([key, value], index) => {
      const [expectedKey, expectedValue] = expected[index]!;
      return key === expectedKey && typeof value === "string" && value === expectedValue;
    })
  );
}
