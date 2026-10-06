import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Language bank" };

export default function BankPage() {
  return <RoutePlaceholder id="bank" />;
}
