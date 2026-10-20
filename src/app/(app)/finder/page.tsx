import type { Metadata } from "next";

import { FinderView } from "@/features/finder/finder-view";
import { finderUrlState, redirectPastLastPage } from "@/features/finder/finder-url";
import { loadFinderState } from "@/features/finder/load-finder-state";

export const metadata: Metadata = { title: "Language Finder" };

export default async function FinderPage(props: PageProps<"/finder">) {
  const url = finderUrlState("/finder", await props.searchParams);
  const state = await loadFinderState(url);
  if (state.kind === "browse") redirectPastLastPage("/finder", url, state.response.pages);

  return (
    <FinderView
      // Remount per query; filters and pages don't remount (see /explore).
      key={url.q}
      basePath="/finder"
      url={url}
      state={state}
      eyebrow="Language Finder"
      title="What do you want to say?"
      description="Describe the idea in your own words. Lexora finds the natural English for it — with context, patterns and examples."
    />
  );
}
