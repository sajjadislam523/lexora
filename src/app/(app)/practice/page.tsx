import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Practice" };

export default function PracticePage() {
  return <RoutePlaceholder id="practice" />;
}
