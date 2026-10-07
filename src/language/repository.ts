import type { LanguageItem } from "./types";

/** Read access to the Phase 1 sample items, which language pages render until step 10. */
export interface LanguageRepository {
  getItem(slug: string): LanguageItem | undefined;
  listItems(): readonly LanguageItem[];
}
