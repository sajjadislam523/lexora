/**
 * The shared language engine's public types. Pages and features depend on these, never on the
 * storage behind them — the prototype repository today, the curated dataset from Phase 3.
 */
import type { DemoLanguageItem, DemoExample } from "@/demo/types";
import type { DemoQuery, SearchMode } from "@/demo/finder";

export type { SearchMode };

/**
 * A public language item. Learner data (such as review status) is deliberately not part of it:
 * public pages render language only, and personal state lives with the account.
 */
export type LanguageItem = Omit<DemoLanguageItem, "status">;

export type LanguageExample = DemoExample;

export type FitGuideData = NonNullable<DemoQuery["guide"]>;

/** A hand-written example search: the keywords that select it and the results it shows. */
export type ExampleSearchDefinition = DemoQuery;

export type SearchResult =
  | {
      kind: "match";
      query: string;
      mode: SearchMode;
      /** How the query was read, in plain words. */
      understoodAs: string;
      /** The word or term that selected these results — shown so matching stays transparent. */
      matchedOn: string;
      items: LanguageItem[];
      guide?: FitGuideData;
      /** Writing vs speaking comparison to show beside the results. */
      skillPair?: NonNullable<LanguageItem["usage"]>;
      /** Show the interactive "which word fits this sentence?" tool instead of result cards. */
      contextTool: boolean;
      related: string[];
    }
  | { kind: "no-match"; query: string };
