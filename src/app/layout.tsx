import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

import { SavedLanguageProvider } from "@/components/language/saved-language";
import { SiteAnalytics } from "@/components/site/analytics";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/server/site-url";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves canonical and Open Graph URLs.
  metadataBase: SITE_URL,
  title: {
    default: "Lexora",
    template: "%s · Lexora",
  },
  description: "Find the right English. Use it naturally. Remember it when it matters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, newsreader.variable, jetbrainsMono.variable)}
      suppressHydrationWarning
    >
      {/* Browser extensions (ColorZilla, Grammarly, …) inject attributes on <html>/<body>.
          suppressHydrationWarning only ignores attribute mismatches on these two elements. */}
      <body suppressHydrationWarning>
        <TooltipProvider delayDuration={300}>
          {/* Shared by public and signed-in pages, so saved state survives moving between them. */}
          <SavedLanguageProvider>{children}</SavedLanguageProvider>
        </TooltipProvider>
        {/* Aggregate page views only; search text and link tokens are removed before sending. */}
        <SiteAnalytics />
      </body>
    </html>
  );
}
