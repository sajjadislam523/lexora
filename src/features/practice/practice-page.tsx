"use client";

import { useSearchParams } from "next/navigation";

import { PracticeSession } from "./practice-session";

/** Reads `?step=` so other screens can deep-link to a specific question. */
export function PracticeFromSearchParams() {
  const step = Number(useSearchParams().get("step")) || undefined;
  return <PracticeSession key={step ?? "intro"} initialStep={step} />;
}
