import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <RoutePlaceholder id="home" />;
}
