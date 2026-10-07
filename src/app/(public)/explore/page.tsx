import type { Metadata } from "next";

import { FinderView } from "@/features/finder/finder-view";
import { loadFinderState } from "@/features/finder/load-finder-state";

const DESCRIPTION =
  "Search for the word, phrase, preposition, collocation or expression you need for IELTS Academic — and see how to use it naturally.";

export async function generateMetadata(props: PageProps<"/explore">): Promise<Metadata> {
  const { q } = await props.searchParams;
  return {
    title: "Explore English for IELTS",
    description: DESCRIPTION,
    alternates: { canonical: "/explore" },
    // Individual searches are thin, duplicate pages; index the language pages instead.
    robots: typeof q === "string" && q.trim() ? { index: false, follow: true } : undefined,
  };
}

/** The public Language Finder. Same view and search as /finder; saving shows the save gate. */
export default async function ExplorePage(props: PageProps<"/explore">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";

  return (
    <FinderView
      // Remount per query so the input and mode follow navigation (back, forward, refresh).
      key={query}
      basePath="/explore"
      query={query}
      state={await loadFinderState(query)}
      eyebrow="Explore"
      title="What are you trying to say?"
      description="Describe the idea in your own words. Lexora finds the natural English for it — with meaning, patterns, examples and common mistakes."
    />
  );
}
