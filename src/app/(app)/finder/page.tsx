import type { Metadata } from "next";

import { FinderView } from "@/features/finder/finder-view";
import { languageRepository, languageSearch } from "@/language";

export const metadata: Metadata = { title: "Language Finder" };

export default async function FinderPage(props: PageProps<"/finder">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";

  return (
    <FinderView
      // Remount per query so the input and mode follow navigation.
      key={query}
      basePath="/finder"
      query={query}
      result={languageSearch.search(query)}
      introSkillPair={languageRepository.getItem("furthermore")?.usage}
      eyebrow="Language Finder"
      title="What do you want to say?"
      description="Describe the idea in your own words. Lexora finds the natural English for it — with context, patterns and examples."
    />
  );
}
