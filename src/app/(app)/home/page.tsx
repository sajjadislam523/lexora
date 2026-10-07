import type { Metadata } from "next";

import { DashboardView } from "@/features/dashboard/dashboard-view";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const session = await requireSession();
  const firstName = session.user.name.trim().split(/\s+/)[0];
  return <DashboardView firstName={firstName} />;
}
