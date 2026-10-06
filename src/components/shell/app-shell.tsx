import { DesktopSidebar, MobileSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { ShellProvider } from "./shell-provider";
import { TopBar } from "./top-bar";

/**
 * The persistent application frame: sidebar, top bar, command palette and the main region.
 * Rendered once by the (app) route group layout, so it persists across page navigation.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <a
        href="#main"
        className="sr-only rounded-md border border-border bg-card type-label text-foreground shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <DesktopSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </div>
      </div>
      <MobileSidebar />
      <CommandPalette />
    </ShellProvider>
  );
}
