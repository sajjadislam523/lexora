import { AppShell } from "@/components/shell/app-shell";
import { SavedItemsProvider } from "@/demo/saved-items";

/** Every authenticated-app page (Phase 2 adds auth) renders inside the persistent shell. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SavedItemsProvider>
      <AppShell>{children}</AppShell>
    </SavedItemsProvider>
  );
}
