import type { Metadata } from "next";

import { SettingsView } from "@/features/settings/settings-view";
import { requireSession } from "@/server/auth/session";
import { getLearnerProfile } from "@/server/repositories/learner-profile";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const profile = await getLearnerProfile(session.user.id);

  return (
    <SettingsView
      user={{
        name: session.user.name,
        email: session.user.email,
        createdAt: session.user.createdAt,
      }}
      profile={profile}
    />
  );
}
