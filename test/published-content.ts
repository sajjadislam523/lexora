/**
 * The real content in content/, validated and treated as published. The golden search suite
 * checks search over the dataset as learners will see it once reviewed: while Wave 1 waits for
 * the owner's review its items are drafts, and this promotes them for the test only.
 */
import { readContentDir } from "@/server/content/files";
import { formatIssue, validateContent, type ValidatedContent } from "@/server/content/validate";

export async function loadPublishedContent(): Promise<ValidatedContent> {
  const result = validateContent(await readContentDir());
  if (!result.ok) throw new Error(result.issues.map(formatIssue).join("\n"));
  return {
    ...result.content,
    items: result.content.items.map((item) =>
      item.status === "draft"
        ? {
            ...item,
            status: "published",
            review: { ...item.review, reviewer: "golden-suite", on: "2026-10-07" },
          }
        : item,
    ),
  };
}
