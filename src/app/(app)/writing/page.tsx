import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Writing Lab" };

export default function WritingPage() {
  return <RoutePlaceholder id="writing" />;
}
