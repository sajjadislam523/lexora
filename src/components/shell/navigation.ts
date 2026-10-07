import {
  BarChart3,
  BookMarked,
  Dumbbell,
  Home,
  Mic,
  Palette,
  PenLine,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavEntry = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line describing the page, used by the header and placeholders. */
  description: string;
  /** Honest build status shown on placeholder screens. */
  status: string;
  /** What the finished screen will do — shown on placeholders. */
  plans?: string[];
  /** Built screens worth visiting from a placeholder. */
  seeAlso?: { label: string; href: string }[];
};

/** Primary destinations, in sidebar order. */
export const PRIMARY_NAV: NavEntry[] = [
  {
    id: "home",
    href: "/home",
    label: "Home",
    icon: Home,
    description: "What to review today, weak areas and recent searches.",
    status: "Prototype with sample learner data.",
  },
  {
    id: "finder",
    href: "/finder",
    label: "Language Finder",
    icon: Search,
    description: "Describe what you want to say and find the language that fits.",
    status: "Prototype with example searches. Real search is built in Phase 4.",
  },
  {
    id: "bank",
    href: "/bank",
    label: "Language bank",
    icon: BookMarked,
    description: "Everything you have saved, with notes and review status.",
    status: "Planned for Phase 5 — Personal learning.",
    plans: [
      "Everything you save from the Finder, grouped by kind of language",
      "Your own notes and example sentences beside each item",
      "Review status and the next time each item comes back",
    ],
    seeAlso: [
      { label: "Find language to save", href: "/finder" },
      { label: "See a saved item", href: "/language/significant" },
    ],
  },
  {
    id: "practice",
    href: "/practice",
    label: "Practice",
    icon: Dumbbell,
    description: "Short exercises built from your language bank.",
    status: "Prototype session. Real exercises are generated in Phase 6.",
  },
  {
    id: "writing",
    href: "/writing",
    label: "Writing Lab",
    icon: PenLine,
    description: "Audit your own writing for repetition, prepositions and collocations.",
    status: "Planned for Phase 7 — Writing Lab.",
    plans: [
      "Paste or write a Task 1 or Task 2 response",
      "Repetition, preposition and collocation checks in place",
      "Suggestions linked to language you can save and practise",
    ],
    seeAlso: [{ label: "Try the Finder", href: "/finder" }],
  },
  {
    id: "speaking",
    href: "/speaking",
    label: "Speaking Lab",
    icon: Mic,
    description: "Record an answer, review the transcript and retry with better language.",
    status: "Planned for Phase 8 — Speaking Lab.",
    plans: [
      "Record an answer to a Speaking Part 1–3 question",
      "Review the transcript with the same language analysis as writing",
      "Retry with better expressions and compare attempts",
    ],
    seeAlso: [
      {
        label: "Writing vs speaking in the Finder",
        href: "/finder?q=natural+speaking+alternative+to+furthermore",
      },
    ],
  },
  {
    id: "progress",
    href: "/progress",
    label: "Progress",
    icon: BarChart3,
    description: "Mastery by category and how your recall is developing.",
    status: "Planned for Phase 5 — Personal learning.",
    plans: [
      "Mastery by kind of language, based on what you actually recall",
      "Weak areas and recurring mistakes over time",
      "No streaks or points — just an honest picture of your progress",
    ],
    seeAlso: [{ label: "See today’s focus", href: "/home" }],
  },
];

/** Secondary destinations, pinned to the bottom of the sidebar. */
export const SECONDARY_NAV: NavEntry[] = [
  {
    id: "design-system",
    href: "/design-system",
    label: "Design system",
    icon: Palette,
    description: "Tokens, components and patterns.",
    status: "Available.",
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Your profile, target band and preferences.",
    status: "Available.",
  },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavEntry(pathname: string) {
  return ALL_NAV.find((entry) => isActive(pathname, entry.href));
}

/** Breadcrumb for the top bar. Language pages are public and render outside the app shell. */
export function resolveBreadcrumb(pathname: string): { parent?: NavEntry; label: string } {
  return { label: findNavEntry(pathname)?.label ?? "Lexora" };
}

export function getNavEntry(id: string): NavEntry {
  const entry = ALL_NAV.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown navigation entry: ${id}`);
  return entry;
}
