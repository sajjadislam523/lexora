/**
 * Types for the Phase 1 sample items that language pages render until Phase 3 step 10. Search
 * types live in ./search/types; the Phase 3 domain model in ./model.
 */
import type { DemoExample, DemoLanguageItem } from "@/demo/types";

/**
 * A public sample item. Learner data (such as review status) is deliberately not part of it:
 * public pages render language only, and personal state lives with the account.
 */
export type LanguageItem = Omit<DemoLanguageItem, "status">;

export type LanguageExample = DemoExample;
