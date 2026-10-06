import type { Metadata } from "next";
import { Suspense } from "react";

import { PracticeFromSearchParams } from "@/features/practice/practice-page";
import { PracticeSession } from "@/features/practice/practice-session";

export const metadata: Metadata = { title: "Practice" };

export default function PracticePage() {
  return (
    <Suspense fallback={<PracticeSession />}>
      <PracticeFromSearchParams />
    </Suspense>
  );
}
