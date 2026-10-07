/**
 * The real content in content/, validated, for the golden search suite. Only published items
 * reach search, exactly as for learners, so drafts under review never affect the suite.
 */
import { readContentDir } from "@/server/content/files";
import { formatIssue, validateContent, type ValidatedContent } from "@/server/content/validate";

export async function loadPublishedContent(): Promise<ValidatedContent> {
  const result = validateContent(await readContentDir());
  if (!result.ok) throw new Error(result.issues.map(formatIssue).join("\n"));
  return result.content;
}
