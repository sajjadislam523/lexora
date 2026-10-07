import "server-only";

import { notFound, permanentRedirect } from "next/navigation";

import type { LanguageContentRepository } from "@/language/engine";
import type { LanguageDetail } from "@/language/model";

/**
 * What /language/[slug] shows: a published item, or a 308 to where an old or retired slug now
 * lives, or a real 404. Never anything unpublished. Takes the repository so tests can use their
 * own database.
 */
export async function loadLanguagePage(
  repository: Pick<LanguageContentRepository, "getItemBySlug">,
  slug: string,
): Promise<LanguageDetail> {
  const result = await repository.getItemBySlug(slug);
  if (!result) notFound();
  if ("redirectTo" in result) permanentRedirect(`/language/${result.redirectTo}`);
  return result;
}
