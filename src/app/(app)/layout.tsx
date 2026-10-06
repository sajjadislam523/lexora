import { AppShell } from "@/components/shell/app-shell";
import { SavedItemsProvider } from "@/demo/saved-items";
import { requireSession } from "@/server/auth/session";

/**
 * Every app page renders inside the persistent shell, and only for a signed-in user.
 * requireSession() validates the session against the database (the proxy only checks a cookie).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();

  return (
    <SavedItemsProvider>
      <AppShell>{children}</AppShell>
    </SavedItemsProvider>
  );
}
