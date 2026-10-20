import type { Metadata } from "next";

import { FinderView } from "@/features/finder/finder-view";
import { finderUrlState, isFilteredView, redirectPastLastPage } from "@/features/finder/finder-url";
import { loadFinderState } from "@/features/finder/load-finder-state";
import { finderHref, parseFinderParams } from "@/language/filters";

const DESCRIPTION =
  "Search for the word, phrase, preposition, collocation or expression you need for IELTS Academic — and see how to use it naturally.";

export async function generateMetadata(props: PageProps<"/explore">): Promise<Metadata> {
  const state = parseFinderParams(await props.searchParams);
  // Filtered and paged views: not indexed, canonical to themselves (Phase 4 decision D2).
  if (isFilteredView(state)) {
    return {
      title: "Explore English for IELTS",
      description: DESCRIPTION,
      alternates: { canonical: finderHref("/explore", state) },
      robots: { index: false, follow: true },
    };
  }
  return {
    title: "Explore English for IELTS",
    description: DESCRIPTION,
    alternates: { canonical: "/explore" },
    // Individual searches are thin, duplicate pages; index the language pages instead.
    robots: state.q ? { index: false, follow: true } : undefined,
  };
}

/** The public Language Finder. Same view and search as /finder; saving shows the save gate. */
export default async function ExplorePage(props: PageProps<"/explore">) {
  const url = finderUrlState("/explore", await props.searchParams);
  const state = await loadFinderState(url);
  if (state.kind === "browse") redirectPastLastPage("/explore", url, state.response.pages);

  return (
    <FinderView
      // Remount per query so the input and mode follow navigation; filters and pages don't
      // remount, so a filter control keeps focus while its results load.
      key={url.q}
      basePath="/explore"
      url={url}
      state={state}
      eyebrow="Explore"
      title="What are you trying to say?"
      description="Describe the idea in your own words. Lexora finds the natural English for it — with meaning, patterns, examples and common mistakes."
    />
  );
}
