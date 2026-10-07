import type { ExampleSearchDefinition, LanguageItem } from "./types";

/**
 * Read access to public language content. Holds no user data. Phase 3 adds a database-backed
 * implementation; callers keep using this interface.
 */
export interface LanguageRepository {
  getItem(slug: string): LanguageItem | undefined;
  listItems(): readonly LanguageItem[];
  listExampleSearches(): readonly ExampleSearchDefinition[];
}
