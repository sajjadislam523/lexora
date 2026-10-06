import type { Metadata } from "next";

import { RoutePlaceholder } from "@/components/shell/route-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <RoutePlaceholder id="settings" />;
}
