import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Speaking Lab" };

export default function SpeakingPage() {
  return <RoutePlaceholder id="speaking" />;
}
