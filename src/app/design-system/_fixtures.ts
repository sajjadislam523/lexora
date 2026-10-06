/**
 * Illustrative sample data for the design-system playground only.
 * This is NOT the language dataset and must not be imported by product code.
 * The real, curated language content arrives with the language engine in Phase 3.
 */
import type { LanguageResultCardProps } from "@/components/lexora/language-result-card";

type SampleResult = Omit<LanguageResultCardProps, "saved" | "onSaveToggle" | "className"> & {
  id: string;
};

export const SAMPLE_RESULTS: SampleResult[] = [
  {
    id: "responsible-for",
    term: "responsible for",
    category: "preposition",
    meaning: "Having the duty to deal with something, or being the cause of it.",
    pattern: "be responsible for + noun / -ing",
    example: {
      text: "Local governments are responsible for maintaining public parks.",
      highlight: "responsible for",
    },
    note: "A common error is “responsible of”.",
    tags: ["neutral", "writing", "speaking"],
  },
  {
    id: "significant",
    term: "significant",
    category: "synonym",
    meaning: "Large or important enough to have a noticeable effect.",
    pattern: "a significant + increase / impact / role",
    example: {
      text: "Technology has played a significant role in reshaping education.",
      highlight: "significant",
    },
    note: "More precise than “important” when you mean size or effect.",
    tags: ["formal", "writing"],
  },
  {
    id: "in-contrast",
    term: "In contrast,",
    category: "linker",
    meaning: "Introduces a sentence that shows a clear difference from the previous one.",
    pattern: "In contrast, + clause",
    example: {
      text: "Urban populations grew rapidly. In contrast, rural areas saw a steady decline.",
      highlight: "In contrast,",
    },
    tags: ["formal", "writing"],
  },
  {
    id: "pose-a-threat",
    term: "pose a threat",
    category: "collocation",
    meaning: "To be a possible danger to someone or something.",
    pattern: "pose a (serious / significant) threat to + noun",
    example: {
      text: "Rising sea levels pose a serious threat to coastal cities.",
      highlight: "pose a serious threat",
    },
    tags: ["formal", "writing"],
  },
  {
    id: "i-see-your-point",
    term: "I see your point, but…",
    category: "expression",
    meaning: "Acknowledges another view politely before disagreeing with it.",
    pattern: "I see your point, but + clause",
    example: {
      text: "I see your point, but I think the costs outweigh the benefits.",
      highlight: "I see your point, but",
    },
    tags: ["neutral", "speaking"],
  },
  {
    id: "not-only-but-also",
    term: "Not only … but also …",
    category: "pattern",
    meaning: "Adds a second, often stronger, point to the first.",
    pattern: "Not only + auxiliary + subject + verb, but + subject + also …",
    example: {
      text: "Not only does exercise improve health, but it also reduces stress.",
      highlight: "Not only",
    },
    note: "Inverts the subject and auxiliary after “Not only”.",
    tags: ["formal", "writing", "speaking"],
  },
];

export const SAMPLE_QUERIES = [
  "synonyms for important",
  "preposition after responsible",
  "I want to express contrast",
  "I want to disagree politely",
  "natural speaking alternative to furthermore",
];
