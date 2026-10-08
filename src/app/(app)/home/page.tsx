import type { Metadata } from "next";

import { DashboardView } from "@/features/dashboard/dashboard-view";
import { requireSession } from "@/server/auth/session";
import { countSavedSenses } from "@/server/repositories/saved-senses";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const session = await requireSession();
  const firstName = session.user.name.trim().split(/\s+/)[0];
  const savedCount = await countSavedSenses(session.user.id);
  return (
    <DashboardView
      firstName={firstName}
      savedCount={savedCount}
      unverifiedEmail={session.user.emailVerified ? undefined : session.user.email}
    />
  );
}
