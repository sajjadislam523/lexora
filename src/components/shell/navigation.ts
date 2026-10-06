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
};

/** Primary destinations, in sidebar order. */
export const PRIMARY_NAV: NavEntry[] = [
  {
    id: "home",
    href: "/home",
    label: "Home",
    icon: Home,
    description: "What to review today, weak areas and recent searches.",
    status: "The dashboard mock is the next Phase 1 item.",
  },
  {
    id: "finder",
    href: "/finder",
    label: "Language Finder",
    icon: Search,
    description: "Describe what you want to say and find the language that fits.",
    status: "The Finder mock arrives later in Phase 1. Real search is built in Phase 4.",
  },
  {
    id: "bank",
    href: "/bank",
    label: "Language bank",
    icon: BookMarked,
    description: "Everything you have saved, with notes and review status.",
    status: "Planned for Phase 5 — Personal learning.",
  },
  {
    id: "practice",
    href: "/practice",
    label: "Practice",
    icon: Dumbbell,
    description: "Short exercises built from your language bank.",
    status: "A practice UI mock arrives later in Phase 1. Real exercises are built in Phase 6.",
  },
  {
    id: "writing",
    href: "/writing",
    label: "Writing Lab",
    icon: PenLine,
    description: "Audit your own writing for repetition, prepositions and collocations.",
    status: "Planned for Phase 7 — Writing Lab.",
  },
  {
    id: "speaking",
    href: "/speaking",
    label: "Speaking Lab",
    icon: Mic,
    description: "Record an answer, review the transcript and retry with better language.",
    status: "Planned for Phase 8 — Speaking Lab.",
  },
  {
    id: "progress",
    href: "/progress",
    label: "Progress",
    icon: BarChart3,
    description: "Mastery by category and how your recall is developing.",
    status: "Planned for Phase 5 — Personal learning.",
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
    status: "Planned for Phase 2 — Application foundation.",
  },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavEntry(pathname: string) {
  return ALL_NAV.find((entry) => isActive(pathname, entry.href));
}

export function getNavEntry(id: string): NavEntry {
  const entry = ALL_NAV.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown navigation entry: ${id}`);
  return entry;
}
