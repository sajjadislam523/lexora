import type { Metadata } from "next";
import { Suspense } from "react";

import { FinderFromSearchParams } from "@/features/finder/finder-page";
import { FinderView } from "@/features/finder/finder-view";

export const metadata: Metadata = { title: "Language Finder" };

export default function FinderPage() {
  return (
    // The prerendered HTML shows the empty Finder; the query is applied on the client.
    <Suspense fallback={<FinderView query="" />}>
      <FinderFromSearchParams />
    </Suspense>
  );
}
