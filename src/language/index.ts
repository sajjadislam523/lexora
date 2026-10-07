import "server-only";

import { db } from "@/server/db/client";
import { DatabaseLanguageRepository } from "@/server/repositories/language";

import { PrototypeLanguageRepository } from "./prototype-repository";
import { LanguageSearchService } from "./search/service";

/**
 * The shared language engine's composition root. Public pages and signed-in pages read language
 * through these objects; none of them knows where it is stored. Server-only, so the dataset stays
 * out of client bundles — pages pass results down as props.
 */

/** Published language in PostgreSQL (imported from content/). */
export const languageContent = new DatabaseLanguageRepository(db);

/** Deterministic search over it: Explore, the Finder and the landing page all use this one. */
export const languageSearch = new LanguageSearchService(languageContent);

/**
 * The Phase 1 sample items that language pages, the sitemap and the command palette still render.
 * Replaced by `languageContent` in Phase 3 step 10; nothing searches it any more.
 */
export const languageRepository = new PrototypeLanguageRepository();

export type * from "./types";
export type * from "./search/types";
