import type { Metadata } from "next";

import { DashboardView } from "@/features/dashboard/dashboard-view";
import { requireSession } from "@/server/auth/session";
import { loadHome } from "@/server/learning/home";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  // The learner comes from the session, never from the request.
  const session = await requireSession();
  const firstName = session.user.name.trim().split(/\s+/)[0];
  // Only the data load is guarded; rendering errors go to the (app) error boundary.
  const home = await loadHome(session.user.id, new Date()).catch((error: unknown) => {
    console.error("Home failed to load", error instanceof Error ? error.name : "error");
    return null;
  });
  return (
    <DashboardView
      firstName={firstName}
      home={home}
      unverifiedEmail={session.user.emailVerified ? undefined : session.user.email}
    />
  );
}
