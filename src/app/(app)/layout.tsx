import { AppShell } from "@/components/shell/app-shell";
import { SavedItemsProvider } from "@/demo/saved-items";
import { requireSession, toSafeUser } from "@/server/auth/session";

/**
 * Every app page renders inside the persistent shell, and only for a signed-in user.
 * requireSession() validates the session against the database (the proxy only checks a cookie).
 * Only safe user fields cross into client components.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <SavedItemsProvider>
      <AppShell user={toSafeUser(session.user)}>{children}</AppShell>
    </SavedItemsProvider>
  );
}
