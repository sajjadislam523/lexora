import { AppShell } from "@/components/shell/app-shell";

/** Every authenticated-app page (Phase 2 adds auth) renders inside the persistent shell. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
