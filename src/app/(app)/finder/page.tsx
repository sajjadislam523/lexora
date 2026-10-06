import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Language Finder" };

export default function FinderPage() {
  return <RoutePlaceholder id="finder" />;
}
