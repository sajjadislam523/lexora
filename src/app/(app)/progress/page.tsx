import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return <RoutePlaceholder id="progress" />;
}
