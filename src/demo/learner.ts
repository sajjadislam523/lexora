/**
 * Phase 1 prototype content — a sample learner. There are no accounts yet (Phase 2);
 * real progress comes from review history in Phase 5.
 */
import type { LanguageCategory } from "@/components/lexora/language-category";

export const SAMPLE_LEARNER = {
  focus: "This week: linkers and prepositions for Writing Task 2",
  review: { total: 12, done: 4, minutes: 8 },
  weakAreas: [
    {
      category: "preposition",
      label: "Prepositions",
      reason: "3 mistakes this week — depend on, responsible for",
    },
    { category: "linker", label: "Linkers", reason: "“however” in 6 of your last 8 contrasts" },
    { category: "collocation", label: "Collocations", reason: "“make research” appeared twice" },
  ] satisfies { category: LanguageCategory; label: string; reason: string }[],
  continueLearning: [
    { slug: "significant", context: "Use it with measurable change: “a significant increase in…”" },
    { slug: "depend-on", context: "Always on — “many people depend on buses”" },
    { slug: "play-a-crucial-role", context: "A Task 2 favourite: play a crucial role in + -ing" },
    {
      slug: "on-the-other-hand",
      context: "For the other side of an argument, not a simple difference",
    },
  ],
  mistakes: [
    {
      wrong: "depend of",
      right: "depend on",
      type: "Preposition",
      why: "Depend always takes on.",
      action: { label: "Practise", href: "/practice?step=3" },
    },
    {
      wrong: "make a research",
      right: "conduct research",
      type: "Collocation",
      why: "Research is uncountable and goes with conduct or do.",
      action: { label: "Practise", href: "/practice?step=5" },
    },
    {
      wrong: "important ×4",
      right: "significant · crucial",
      type: "Repetition",
      why: "Used four times in your last essay. Choose by meaning.",
      action: { label: "Find alternatives", href: "/finder?q=better+word+for+important" },
    },
  ],
};
