"use client";

import { useSearchParams } from "next/navigation";

import { FinderView } from "./finder-view";

/** Reads `?q=` and remounts the view per query so input state follows navigation. */
export function FinderFromSearchParams() {
  const query = useSearchParams().get("q") ?? "";
  return <FinderView key={query} query={query} />;
}
