import "server-only";

import { PrototypeLanguageRepository } from "./prototype-repository";
import { LanguageSearchService } from "./search";

/**
 * The shared language engine. Public pages and signed-in pages both read language through
 * these two objects; neither knows where the content is stored. Server-only, so the dataset
 * stays out of client bundles — pages pass the results down as props.
 */
export const languageRepository = new PrototypeLanguageRepository();
export const languageSearch = new LanguageSearchService(languageRepository);

export type * from "./types";
